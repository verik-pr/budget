import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { asNonEmptyString, asValidDate } from "@/lib/api-validation"

// Private Posten darf nur der Ersteller als Ganzes bearbeiten/löschen
async function privateForeignItem(receiptId: string, userId: string) {
  return prisma.transaction.findFirst({
    where: { receiptId, isPrivate: true, userId: { not: userId } },
    select: { id: true },
  })
}

// PATCH /api/receipts/[id] — Titel, Datum, Zahler und/oder Aufteilung für
// ALLE Posten einer gescannten Quittung aufs Mal ändern
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { merchant, date, contributor, split } = await req.json()

  const parsedMerchant = merchant !== undefined ? asNonEmptyString(merchant) : undefined
  const parsedDate = date !== undefined ? asValidDate(date) : undefined
  if (merchant !== undefined && !parsedMerchant) return NextResponse.json({ error: "Ungültiger Titel" }, { status: 400 })
  if (date !== undefined && !parsedDate) return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 })

  // Zahler + Aufteilung kommen immer zusammen: der Split-Partner leitet sich
  // aus dem Zahler ab (erik ↔ celine)
  if ((contributor === undefined) !== (split === undefined)) {
    return NextResponse.json({ error: "Zahler und Aufteilung zusammen setzen" }, { status: 400 })
  }
  let splitData: { contributor: string; sharedWith: string | null; sharedRatio: number | null } | undefined
  if (contributor !== undefined) {
    if (contributor !== "erik" && contributor !== "celine") {
      return NextResponse.json({ error: "Ungültiger Zahler" }, { status: 400 })
    }
    if (split !== "solo" && split !== "half" && split !== "full") {
      return NextResponse.json({ error: "Ungültige Aufteilung" }, { status: 400 })
    }
    const partner = contributor === "erik" ? "celine" : "erik"
    splitData = {
      contributor,
      sharedWith: split === "solo" ? null : partner,
      sharedRatio: split === "solo" ? null : split === "half" ? 0.5 : 1.0,
    }
  }

  if (parsedMerchant === undefined && parsedDate === undefined && !splitData) {
    return NextResponse.json({ error: "Nichts zu ändern" }, { status: 400 })
  }

  if (await privateForeignItem(id, session.user.id)) {
    return NextResponse.json({ error: "Private Quittung — nur der Ersteller kann sie ändern" }, { status: 403 })
  }

  const { count } = await prisma.transaction.updateMany({
    where: { receiptId: id },
    data: {
      ...(parsedMerchant ? { receiptMerchant: parsedMerchant } : {}),
      ...(parsedDate ? { date: parsedDate } : {}),
      ...(splitData ?? {}),
    },
  })
  if (count === 0) return NextResponse.json({ error: "Quittung nicht gefunden" }, { status: 404 })
  return NextResponse.json({ ok: true, updated: count })
}

// DELETE /api/receipts/[id] — die ganze Quittung mit allen Posten löschen
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (await privateForeignItem(id, session.user.id)) {
    return NextResponse.json({ error: "Private Quittung — nur der Ersteller kann sie löschen" }, { status: 403 })
  }

  const { count } = await prisma.transaction.deleteMany({ where: { receiptId: id } })
  if (count === 0) return NextResponse.json({ error: "Quittung nicht gefunden" }, { status: 404 })
  return NextResponse.json({ ok: true, deleted: count })
}
