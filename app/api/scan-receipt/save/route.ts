import { getServerSession } from "next-auth"
import { after, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkBudgetThresholds, notifyPartnerOfBooking } from "@/lib/push-triggers"
import { asFiniteNumber, asNullableString, asPositiveNumber, asValidDate } from "@/lib/api-validation"

type SaveItem = {
  amount: unknown
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

  const categoryIds = [...new Set(items.map(item => asNullableString(item.categoryId)).filter(Boolean))] as string[]
  if (categoryIds.length !== items.length) {
    return NextResponse.json({ error: "Ungültige Kategorie" }, { status: 400 })
  }

  const [categories, account] = await Promise.all([
    prisma.category.findMany({ where: { id: { in: categoryIds } } }),
    accountId ? prisma.account.findUnique({ where: { id: accountId } }) : Promise.resolve(null),
  ])
  if (categories.length !== categoryIds.length) {
    return NextResponse.json({ error: "Kategorie nicht gefunden" }, { status: 400 })
  }
  if (accountId && !account) return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 400 })

  const categoriesById = new Map(categories.map(category => [category.id, category]))
  const receiptId = crypto.randomUUID()
  const prepared = items.map(item => {
    const amount = asPositiveNumber(item.amount)
    const categoryId = asNullableString(item.categoryId)
    const sharedWith = asNullableString(item.sharedWith)
    const sharedRatio = sharedWith ? asFiniteNumber(item.sharedRatio) : null
    if (amount === null || !categoryId || !categoriesById.has(categoryId)) return null
    if (sharedWith && (sharedRatio === null || sharedRatio <= 0 || sharedRatio > 1)) return null
    return {
      amount,
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
    return prisma.transaction.create({
      data: {
        date,
        amount: safeItem.amount,
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
