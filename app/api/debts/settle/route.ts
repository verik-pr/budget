import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getDebtData } from "@/lib/debts"
import { asPositiveNumber } from "@/lib/api-validation"

// Gleicht den Gemeinsam-Saldo (teilweise) aus: legt ein Settlement an,
// bei dem die schuldende Person der anderen den Betrag zahlt.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const data = await getDebtData(session.user.name ?? "")

  const open = Math.abs(data.net)
  if (open < 0.01) return NextResponse.json({ error: "Nichts auszugleichen" }, { status: 400 })

  const amount = body.amount !== undefined ? asPositiveNumber(body.amount) : Math.round(open * 100) / 100
  if (amount === null) return NextResponse.json({ error: "Ungültiger Betrag" }, { status: 400 })
  if (amount > open + 0.005) {
    return NextResponse.json({ error: "Betrag ist grösser als der offene Saldo" }, { status: 400 })
  }

  // net > 0: Partner schuldet mir -> Partner zahlt mir
  const from = data.net > 0 ? data.partnerValue : data.myValue
  const to = data.net > 0 ? data.myValue : data.partnerValue

  // Schutz gegen gleichzeitiges Ausgleichen von beiden Geräten:
  // gleicher Richtungs-Ausgleich innerhalb von 10s wird abgelehnt
  const settlement = await prisma.$transaction(async tx => {
    const recent = await tx.settlement.findFirst({
      where: { fromContributor: from, toContributor: to, createdAt: { gte: new Date(Date.now() - 10_000) } },
    })
    if (recent) return null
    return tx.settlement.create({ data: { amount, fromContributor: from, toContributor: to } })
  })
  if (!settlement) {
    return NextResponse.json({ error: "Gerade eben schon ausgeglichen" }, { status: 409 })
  }

  return NextResponse.json({ ok: true, settlement })
}
