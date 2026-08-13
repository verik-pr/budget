import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { after, NextResponse } from "next/server"
import { checkBudgetThresholds, notifyPartnerOfBooking } from "@/lib/push-triggers"
import { asFiniteNumber, asNullableString, asValidDate } from "@/lib/api-validation"
import { giftcardFactor } from "@/lib/utils"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get("accountId")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  let start: Date, end: Date
  if (startDate && endDate) {
    start = new Date(startDate)
    end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return NextResponse.json({ error: "Ungültiger Datumsbereich" }, { status: 400 })
    }
  } else {
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1))
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Ungültiger Zeitraum" }, { status: 400 })
    }
    start = new Date(year, month - 1, 1)
    end = new Date(year, month, 1)
  }

  // Beim persönlichen Konto auch Buchungen ohne Konto-Zuordnung zeigen —
  // gleiche Logik wie das Dashboard, sonst widersprechen sich die Summen
  let accountFilter = {}
  if (accountId) {
    const account = await prisma.account.findUnique({ where: { id: accountId }, select: { type: true } })
    accountFilter = account?.type === "personal"
      ? { OR: [{ accountId }, { accountId: null }] }
      : { accountId }
  }

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start, lt: end }, ...accountFilter },
    include: { category: true, user: { select: { id: true, name: true, color: true } }, account: { select: { id: true, name: true, icon: true, color: true } } },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(transactions)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { date, amount, description, categoryId, photoPath, contributor, accountId, sharedWith, sharedRatio, note, receiptId, receiptMerchant } = body
  const parsedDate = asValidDate(date)
  const parsedAmount = asFiniteNumber(amount)
  const parsedAccountId = asNullableString(accountId)
  const parsedCategoryId = asNullableString(categoryId)
  const parsedSharedWith = asNullableString(sharedWith)
  const parsedSharedRatio = parsedSharedWith ? asFiniteNumber(sharedRatio) : null

  if (!parsedDate || parsedAmount === null || parsedAmount <= 0 || !parsedCategoryId) {
    return NextResponse.json({ error: "Fehlende Felder" }, { status: 400 })
  }
  if (sharedWith && !parsedSharedWith) return NextResponse.json({ error: "Ungültiger Split-Partner" }, { status: 400 })
  if (parsedSharedWith && (parsedSharedRatio === null || parsedSharedRatio <= 0 || parsedSharedRatio > 1)) {
    return NextResponse.json({ error: "Ungültiger Split-Anteil" }, { status: 400 })
  }

  // Resolve current user by email to handle stale session IDs after DB resets
  const currentUser = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!currentUser) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 })

  const [category, account] = await Promise.all([
    prisma.category.findUnique({ where: { id: parsedCategoryId } }),
    parsedAccountId ? prisma.account.findUnique({ where: { id: parsedAccountId } }) : Promise.resolve(null),
  ])
  if (!category) return NextResponse.json({ error: "Kategorie nicht gefunden" }, { status: 400 })
  if (parsedAccountId && !account) return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 400 })

  // Geschenkkarten: eingegeben wird der Beleg-Betrag (nominal), gebucht der
  // effektive Preis (× Rabattfaktor); Beleg-Betrag wandert in faceAmount
  const isGiftcard = account?.type === "giftcard"
  const factor = giftcardFactor(account)

  const transaction = await prisma.transaction.create({
    data: {
      date: parsedDate,
      amount: isGiftcard ? Math.round(parsedAmount * factor * 100) / 100 : parsedAmount,
      ...(isGiftcard ? { faceAmount: parsedAmount } : {}),
      description: asNullableString(description),
      photoPath: asNullableString(photoPath),
      categoryId: parsedCategoryId,
      userId: currentUser.id,
      contributor: asNullableString(contributor),
      accountId: parsedAccountId,
      ...(parsedSharedWith ? { sharedWith: parsedSharedWith, sharedRatio: parsedSharedRatio } : {}),
      note: asNullableString(note),
      receiptId: asNullableString(receiptId),
      receiptMerchant: asNullableString(receiptMerchant),
    },
    include: { category: true, user: { select: { id: true, name: true, color: true } } },
  })

  after(async () => {
    try {
      await checkBudgetThresholds(currentUser.id, transaction.categoryId, transaction.date)
      if (transaction.sharedWith) {
        await notifyPartnerOfBooking(currentUser.id, transaction.sharedWith, transaction.amount, transaction.description, transaction.category.name)
      }
    } catch (err) {
      console.error("push trigger error", err)
    }
  })

  return NextResponse.json(transaction)
}
