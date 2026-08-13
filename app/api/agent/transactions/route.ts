import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function auth(req: NextRequest) {
  const key = process.env.AGENT_API_KEY
  if (!key) return false
  const header = req.headers.get("authorization") ?? ""
  return header === `Bearer ${key}`
}

// GET /api/agent/transactions — kompletter Export aller Buchungen (Backup)
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const transactions = await prisma.transaction.findMany({
    orderBy: { date: "asc" },
    include: {
      category: { select: { name: true, icon: true, type: true } },
      account: { select: { name: true } },
      user: { select: { email: true, name: true } },
    },
  })
  return NextResponse.json({ count: transactions.length, transactions })
}

// DELETE /api/agent/transactions?confirm=ALLE — löscht ALLE Buchungen
// (plus BudgetAlertSent, damit Budget-Alerts nach dem Neustart wieder
// feuern). Bewusst hinter einem Confirm-Parameter, damit ein versehent-
// licher DELETE-Aufruf nicht die ganze Historie wegputzt.
export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (req.nextUrl.searchParams.get("confirm") !== "ALLE") {
    return NextResponse.json({ error: "Bestätigung fehlt: ?confirm=ALLE" }, { status: 400 })
  }

  const [deleted] = await prisma.$transaction([
    prisma.transaction.deleteMany({}),
    prisma.budgetAlertSent.deleteMany({}),
  ])
  return NextResponse.json({ ok: true, deleted: deleted.count })
}
