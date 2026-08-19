import { getServerSession } from "next-auth"
import { after, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkBudgetThresholds, notifyPartnerOfBooking } from "@/lib/push-triggers"
import { asFiniteNumber, asNullableString, asPositiveNumber, asValidDate } from "@/lib/api-validation"
import { giftcardFactor } from "@/lib/utils"

type SaveItem = {
  amount: unknown
  faceAmount: unknown
  categoryId: unknown
  description: unknown
  contributor: unknown
  sharedWith: unknown
  sharedRatio: unknown
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const date = asValidDate(body.date)
  const accountId = asNullableString(body.accountId)
  const note = asNullableString(body.note)
  const receiptMerchant = asNullableString(body.receiptMerchant)
  const items = Array.isArray(body.items) ? body.items as SaveItem[] : []

  if (!date || items.length === 0 || items.length > 100) {
    return NextResponse.json({ error: "Ungültiger Beleg" }, { status: 400 })
  }

  const currentUser = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!currentUser) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 })

  if (items.some(item => !asNullableString(item.categoryId))) {
    return NextResponse.json({ error: "Ungültige Kategorie" }, { status: 400 })
  }
  const categoryIds = [...new Set(items.map(item => asNullableString(item.categoryId)))] as string[]

  const [categories, account] = await Promise.all([
    prisma.category.findMany({ where: { id: { in: categoryIds } } }),
    accountId ? prisma.account.findUnique({ where: { id: accountId } }) : Promise.resolve(null),
  ])
  if (categories.length !== categoryIds.length) {
    return NextResponse.json({ error: "Kategorie nicht gefunden" }, { status: 400 })
  }
  if (accountId && !account) return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 400 })

  const categoriesById = new Map(categories.map(category => [category.id, category]))

  // Duplikat-Check: gleicher Tag + gleicher Händler + gleiche Summe → 409,
  // ausser der Client bestätigt mit force:true (z.B. beim Stapel-Erfassen alter Belege)
  if (body.force !== true) {
    // Vergleich auf Beleg-Beträgen (faceAmount): bei Rabatt-Verteilung und
    // Geschenkkarten weicht der gebuchte amount vom aufgedruckten Betrag ab
    const incomingTotal = items.reduce((s, item) => s + (asPositiveNumber(item.faceAmount) ?? asPositiveNumber(item.amount) ?? 0), 0)
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart.getTime() + 86400000)
    const sameDay = await prisma.transaction.findMany({
      where: { date: { gte: dayStart, lt: dayEnd }, receiptId: { not: null } },
      select: { receiptId: true, receiptMerchant: true, amount: true, faceAmount: true },
    })
    const groups = new Map<string, { merchant: string | null; total: number }>()
    for (const t of sameDay) {
      const g = groups.get(t.receiptId!) ?? { merchant: t.receiptMerchant, total: 0 }
      // Vergleich auf Beleg-Beträgen: bei Geschenkkarten weicht amount (effektiv) ab
      g.total += t.faceAmount ?? t.amount
      groups.set(t.receiptId!, g)
    }
    const wanted = receiptMerchant?.trim().toLowerCase() ?? null
    const duplicate = [...groups.values()].find(g => {
      const sameTotal = Math.abs(g.total - incomingTotal) < 0.005
      const sameMerchant = wanted === null
        ? g.merchant == null
        : g.merchant?.trim().toLowerCase() === wanted
      return sameTotal && sameMerchant
    })
    if (duplicate) {
      return NextResponse.json({
        error: "Möglicherweise bereits erfasst",
        duplicate: true,
        merchant: duplicate.merchant,
        total: duplicate.total,
      }, { status: 409 })
    }
  }

  const receiptId = crypto.randomUUID()
  // Geschenkkarten: Posten-Beträge sind Beleg-Beträge (nominal), gebucht wird
  // der effektive Preis (× Rabattfaktor)
  const isGiftcard = account?.type === "giftcard"
  const factor = giftcardFactor(account)
  const prepared = items.map(item => {
    const amount = asPositiveNumber(item.amount)
    const categoryId = asNullableString(item.categoryId)
    const sharedWith = asNullableString(item.sharedWith)
    const sharedRatio = sharedWith ? asFiniteNumber(item.sharedRatio) : null
    if (amount === null || !categoryId || !categoriesById.has(categoryId)) return null
    if (sharedWith && (sharedRatio === null || sharedRatio <= 0 || sharedRatio > 1)) return null
    return {
      amount,
      faceAmount: asPositiveNumber(item.faceAmount),
      categoryId,
      description: asNullableString(item.description),
      contributor: asNullableString(item.contributor),
      sharedWith,
      sharedRatio,
    }
  })
  if (prepared.some(item => item === null)) {
    return NextResponse.json({ error: "Ungültige Belegposition" }, { status: 400 })
  }

  const transactions = await prisma.$transaction(prepared.map(item => {
    const safeItem = item!
    // Beleg-Betrag: bei Rabatt-Verteilung liefert der Client den Original-
    // Betrag als faceAmount; bei Geschenkkarten ist der gesendete amount
    // bereits der Beleg-Betrag. Gespeichert nur, wenn er vom gebuchten
    // (effektiven) Betrag abweicht — dann bleibt das Original sichtbar.
    const effective = isGiftcard ? Math.round(safeItem.amount * factor * 100) / 100 : safeItem.amount
    const face = safeItem.faceAmount ?? (isGiftcard ? safeItem.amount : null)
    return prisma.transaction.create({
      data: {
        date,
        amount: effective,
        ...(face !== null && Math.abs(face - effective) >= 0.005 ? { faceAmount: face } : {}),
        description: safeItem.description,
        categoryId: safeItem.categoryId,
        userId: currentUser.id,
        contributor: safeItem.contributor,
        accountId,
        note,
        receiptId,
        receiptMerchant,
        ...(safeItem.sharedWith ? { sharedWith: safeItem.sharedWith, sharedRatio: safeItem.sharedRatio } : {}),
      },
      include: { category: true },
    })
  }))

  after(async () => {
    try {
      for (const transaction of transactions) {
        await checkBudgetThresholds(currentUser.id, transaction.categoryId, transaction.date)
        if (transaction.sharedWith) {
          await notifyPartnerOfBooking(currentUser.id, transaction.sharedWith, transaction.amount, transaction.description, transaction.category.name)
        }
      }
    } catch (err) {
      console.error("scan save push trigger error", err)
    }
  })

  return NextResponse.json({ ok: true, count: transactions.length, receiptId })
}
