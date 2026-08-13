import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { asNonEmptyString, asValidDate } from "@/lib/api-validation"

// PATCH /api/receipts/[id] — Titel (receiptMerchant) und/oder Datum für
// ALLE Posten einer gescannten Quittung aufs Mal ändern
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { merchant, date } = await req.json()

  const parsedMerchant = merchant !== undefined ? asNonEmptyString(merchant) : undefined
  const parsedDate = date !== undefined ? asValidDate(date) : undefined
  if (merchant !== undefined && !parsedMerchant) return NextResponse.json({ error: "Ungültiger Titel" }, { status: 400 })
  if (date !== undefined && !parsedDate) return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 })
  if (parsedMerchant === undefined && parsedDate === undefined) {
    return NextResponse.json({ error: "Nichts zu ändern" }, { status: 400 })
  }

  const { count } = await prisma.transaction.updateMany({
    where: { receiptId: id },
    data: {
      ...(parsedMerchant ? { receiptMerchant: parsedMerchant } : {}),
      ...(parsedDate ? { date: parsedDate } : {}),
    },
  })
  if (count === 0) return NextResponse.json({ error: "Quittung nicht gefunden" }, { status: 404 })
  return NextResponse.json({ ok: true, updated: count })
}
