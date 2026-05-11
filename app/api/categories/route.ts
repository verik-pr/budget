import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

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

  const sums = await prisma.transaction.groupBy({
    by: ["categoryId"],
    _sum: { amount: true },
    where: { date: { gte: new Date(startDate), lt: new Date(endDate) } },
  })
  const spentByCat = new Map(sums.map(s => [s.categoryId, s._sum.amount ?? 0]))

  const enriched = categories.map(c => ({ ...c, spent: spentByCat.get(c.id) ?? 0 }))
  return NextResponse.json(enriched)
}
