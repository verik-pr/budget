import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { asIntegerInRange, asMonthString, asNonEmptyString, asPositiveNumber } from "@/lib/api-validation"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await prisma.recurringTransaction.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const data: {
    active?: boolean; accountId?: string | null; startMonth?: string | null; endMonth?: string | null
    name?: string; amount?: number; dayOfMonth?: number; categoryId?: string
  } = {}

  // Stammdaten nachträglich ändern (z.B. Mieterhöhung) — gilt nur für
  // künftige Buchungen, bereits erzeugte bleiben unverändert
  if ("name" in body) {
    const parsed = asNonEmptyString(body.name)
    if (!parsed) return NextResponse.json({ error: "Ungültiger Name" }, { status: 400 })
    data.name = parsed
  }
  if ("amount" in body) {
    const parsed = asPositiveNumber(body.amount)
    if (parsed === null) return NextResponse.json({ error: "Ungültiger Betrag" }, { status: 400 })
    data.amount = parsed
  }
  if ("dayOfMonth" in body) {
    const parsed = asIntegerInRange(body.dayOfMonth, 1, 31)
    if (parsed === null) return NextResponse.json({ error: "Ungültiger Tag (1–31)" }, { status: 400 })
    data.dayOfMonth = parsed
  }
  if ("categoryId" in body) {
    if (typeof body.categoryId !== "string" || !body.categoryId) {
      return NextResponse.json({ error: "Ungültige Kategorie" }, { status: 400 })
    }
    const category = await prisma.category.findUnique({ where: { id: body.categoryId } })
    if (!category) return NextResponse.json({ error: "Kategorie nicht gefunden" }, { status: 400 })
    data.categoryId = body.categoryId
  }

  if ("active" in body) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 })
    }
    data.active = body.active
  }

  // Konto nachträglich zuweisen/entfernen (z.B. Miete aufs Gemeinsame Konto)
  if ("accountId" in body) {
    if (body.accountId === null || body.accountId === "") {
      data.accountId = null
    } else if (typeof body.accountId === "string") {
      const account = await prisma.account.findUnique({ where: { id: body.accountId } })
      if (!account) return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 400 })
      data.accountId = body.accountId
    } else {
      return NextResponse.json({ error: "Ungültiges Konto" }, { status: 400 })
    }
  }

  // Laufzeit nachträglich anpassen — z.B. Abo gekündigt per Ende Monat X
  for (const field of ["startMonth", "endMonth"] as const) {
    if (field in body) {
      if (body[field] === null || body[field] === "") {
        data[field] = null
      } else {
        const parsed = asMonthString(body[field])
        if (!parsed) return NextResponse.json({ error: "Ungültiger Monat" }, { status: 400 })
        data[field] = parsed
      }
    }
  }
  if (data.startMonth !== undefined || data.endMonth !== undefined) {
    const existing = await prisma.recurringTransaction.findUnique({ where: { id }, select: { startMonth: true, endMonth: true } })
    if (!existing) return NextResponse.json({ error: "Regel nicht gefunden" }, { status: 404 })
    const start = data.startMonth !== undefined ? data.startMonth : existing.startMonth
    const end = data.endMonth !== undefined ? data.endMonth : existing.endMonth
    if (start && end && end < start) {
      return NextResponse.json({ error: "Ende liegt vor dem Start" }, { status: 400 })
    }
  }

  const rule = await prisma.recurringTransaction.update({
    where: { id },
    data,
    include: {
      category: true,
      user: { select: { id: true, name: true, color: true } },
      account: { select: { id: true, name: true, icon: true, color: true } },
    },
  })
  return NextResponse.json(rule)
}
