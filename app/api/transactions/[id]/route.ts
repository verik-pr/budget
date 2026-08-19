import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { asFiniteNumber, asNullableString, asValidDate } from "@/lib/api-validation"
import { giftcardFactor, maskPrivateTx } from "@/lib/utils"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { category: true, user: { select: { id: true, name: true } }, account: true },
  })
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(maskPrivateTx(transaction, session.user.id))
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { amount, categoryId, description, date, contributor, accountId, sharedWith, sharedRatio } = body
  const existing = await prisma.transaction.findUnique({
    where: { id },
    select: { id: true, accountId: true, amount: true, faceAmount: true, isPrivate: true, userId: true },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  // Private Buchungen darf nur der Ersteller bearbeiten
  if (existing.isPrivate && existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Private Buchung — nur der Ersteller kann sie bearbeiten" }, { status: 403 })
  }

  const parsedAmount = amount !== undefined ? asFiniteNumber(amount) : undefined
  const parsedDate = date !== undefined ? asValidDate(date) : undefined
  const parsedSharedRatio = sharedRatio !== undefined ? asFiniteNumber(sharedRatio) : undefined
  const parsedCategoryId = categoryId !== undefined ? asNullableString(categoryId) : undefined
  const parsedAccountId = accountId !== undefined ? asNullableString(accountId) : undefined
  const parsedSharedWith = sharedWith !== undefined ? asNullableString(sharedWith) : undefined

  if (parsedAmount !== undefined && (parsedAmount === null || parsedAmount <= 0)) {
    return NextResponse.json({ error: "Ungültiger Betrag" }, { status: 400 })
  }
  if (parsedDate !== undefined && !parsedDate) {
    return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 })
  }
  if (parsedSharedRatio !== undefined && parsedSharedRatio !== null && (parsedSharedRatio <= 0 || parsedSharedRatio > 1)) {
    return NextResponse.json({ error: "Ungültiger Split-Anteil" }, { status: 400 })
  }
  if (categoryId !== undefined && !parsedCategoryId) return NextResponse.json({ error: "Ungültige Kategorie" }, { status: 400 })

  // Für die Geschenkkarten-Umrechnung zählt das Konto NACH dem Update
  const targetAccountId = parsedAccountId !== undefined ? parsedAccountId : existing.accountId
  const [category, account, targetAccount, oldAccount] = await Promise.all([
    parsedCategoryId ? prisma.category.findUnique({ where: { id: parsedCategoryId } }) : Promise.resolve(null),
    parsedAccountId ? prisma.account.findUnique({ where: { id: parsedAccountId } }) : Promise.resolve(null),
    targetAccountId ? prisma.account.findUnique({ where: { id: targetAccountId } }) : Promise.resolve(null),
    existing.accountId ? prisma.account.findUnique({ where: { id: existing.accountId } }) : Promise.resolve(null),
  ])
  if (categoryId !== undefined && !category) return NextResponse.json({ error: "Kategorie nicht gefunden" }, { status: 400 })
  if (parsedAccountId && !account) return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 400 })

  // Geschenkkarten & Beleg-Rabatte: Client bearbeitet immer den Beleg-Betrag
  // (nominal); gespeichert wird der effektive Preis. Ein beim Scan anteilig
  // verteilter Gutschein-Rabatt steckt im Verhältnis amount/faceAmount
  // (bereinigt um den Kartenfaktor des BISHERIGEN Kontos) und bleibt beim
  // Bearbeiten und beim Konto-Wechsel erhalten.
  const isGiftcard = targetAccount?.type === "giftcard"
  const factor = giftcardFactor(targetAccount)
  const oldDenom = (existing.faceAmount ?? 0) * giftcardFactor(oldAccount)
  const discountRatio = existing.faceAmount != null && oldDenom > 0 ? existing.amount / oldDenom : 1
  const amountTouched = (parsedAmount !== undefined && parsedAmount !== null) || parsedAccountId !== undefined
  const nominal = parsedAmount !== undefined && parsedAmount !== null
    ? parsedAmount
    : existing.faceAmount ?? existing.amount
  const effective = Math.round(nominal * discountRatio * factor * 100) / 100

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      ...(amountTouched && {
        amount: effective,
        faceAmount: isGiftcard || Math.abs(effective - nominal) >= 0.005 ? nominal : null,
      }),
      ...(parsedCategoryId ? { categoryId: parsedCategoryId } : {}),
      ...(description !== undefined && { description: asNullableString(description) }),
      ...(parsedDate ? { date: parsedDate } : {}),
      ...(contributor !== undefined && { contributor: asNullableString(contributor) }),
      ...(parsedAccountId !== undefined && { accountId: parsedAccountId }),
      ...(parsedSharedWith !== undefined && { sharedWith: parsedSharedWith }),
      ...(parsedSharedRatio !== undefined && { sharedRatio: parsedSharedRatio }),
      ...(body.isPrivate !== undefined && { isPrivate: body.isPrivate === true }),
    },
  })
  return NextResponse.json(transaction)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await prisma.transaction.findUnique({ where: { id }, select: { id: true, isPrivate: true, userId: true } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (existing.isPrivate && existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Private Buchung — nur der Ersteller kann sie löschen" }, { status: 403 })
  }
  await prisma.transaction.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
