import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { asNonEmptyString } from "@/lib/api-validation"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const withSpent = searchParams.get("withSpent") === "true"
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } })

  if (!withSpent || !startDate || !endDate) {
    return NextResponse.json(categories)
  }
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return NextResponse.json({ error: "Ungültiger Datumsbereich" }, { status: 400 })
  }

  const sums = await prisma.transaction.groupBy({
    by: ["categoryId"],
    _sum: { amount: true },
    where: { date: { gte: start, lt: end } },
  })
  const spentByCat = new Map(sums.map(s => [s.categoryId, s._sum.amount ?? 0]))

  const enriched = categories.map(c => ({ ...c, spent: spentByCat.get(c.id) ?? 0 }))
  return NextResponse.json(enriched)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const name = asNonEmptyString(body.name)
  const icon = asNonEmptyString(body.icon) ?? "📦"
  const type = body.type === "income" ? "income" : body.type === "expense" ? "expense" : null

  if (!name || name.length > 40 || !type) {
    return NextResponse.json({ error: "Ungültige Felder" }, { status: 400 })
  }

  const existing = await prisma.category.findFirst({
    where: { name: { equals: name } },
  })
  if (existing) return NextResponse.json({ error: "Kategorie existiert bereits" }, { status: 409 })

  const category = await prisma.category.create({ data: { name, icon, type } })
  return NextResponse.json(category)
}
