import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { asIntegerInRange, asNonEmptyString, asNullableString, asPositiveNumber } from "@/lib/api-validation"

const ACCOUNT_TYPES = new Set(["personal", "shared", "credit", "giftcard"])

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mine = searchParams.get("mine") === "true"

  const raw = await prisma.account.findMany({ orderBy: { createdAt: "asc" } })

  // Geschenkkarten: Restguthaben (nominal) mitliefern — Ausgaben zehren es
  // auf, Einnahmen (Rückerstattungen) füllen es wieder
  const giftcardIds = raw.filter(a => a.type === "giftcard").map(a => a.id)
  let accounts: (typeof raw[number] & { giftcardRemaining?: number })[] = raw
  if (giftcardIds.length > 0) {
    const txs = await prisma.transaction.findMany({
      where: { accountId: { in: giftcardIds } },
      select: { accountId: true, amount: true, faceAmount: true, category: { select: { type: true } } },
    })
    const used = new Map<string, number>()
    for (const t of txs) {
      const face = t.faceAmount ?? t.amount
      used.set(t.accountId!, (used.get(t.accountId!) ?? 0) + (t.category.type === "income" ? -face : face))
    }
    accounts = raw.map(a => a.type === "giftcard"
      ? { ...a, giftcardRemaining: Math.round(((a.giftcardFaceValue ?? 0) - (used.get(a.id) ?? 0)) * 100) / 100 }
      : a)
  }

  if (mine) {
    // Full Disclosure: beide sehen alle Konten (auch das persönliche des
    // Partners); "mine" bestimmt nur noch das Standard-Konto
    const firstName = session.user.name?.split(" ")[0]?.toLowerCase() ?? ""
    const personal = accounts.find(a => a.type === "personal" && a.name.toLowerCase().includes(firstName))
    const defaultId = personal?.id ?? accounts.find(a => a.type !== "credit" && a.type !== "giftcard")?.id ?? null
    return NextResponse.json({ accounts, defaultId })
  }

  return NextResponse.json(accounts)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name, icon, color, type, dueDay, ownerName, giftcardFaceValue, giftcardPrice } = await req.json()
  const parsedName = asNonEmptyString(name)
  const parsedDueDay = dueDay === null || dueDay === undefined || dueDay === "" ? null : asIntegerInRange(dueDay, 1, 31)
  if (!parsedName || !ACCOUNT_TYPES.has(type) || parsedDueDay === null && dueDay !== null && dueDay !== undefined && dueDay !== "") {
    return NextResponse.json({ error: "Ungültige Felder" }, { status: 400 })
  }
  const parsedFace = asPositiveNumber(giftcardFaceValue)
  const parsedPrice = asPositiveNumber(giftcardPrice)
  if (type === "giftcard" && (!parsedFace || !parsedPrice || parsedPrice > parsedFace)) {
    return NextResponse.json({ error: "Guthaben und Kaufpreis nötig (Preis ≤ Guthaben)" }, { status: 400 })
  }
  const account = await prisma.account.create({
    data: {
      name: parsedName,
      icon: asNullableString(icon) || "💳",
      color: asNullableString(color) || "#6366f1",
      type,
      dueDay: parsedDueDay,
      ownerName: asNullableString(ownerName),
      ...(type === "giftcard" ? { giftcardFaceValue: parsedFace, giftcardPrice: parsedPrice } : {}),
    },
  })
  return NextResponse.json(account)
}
