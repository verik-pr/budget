import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rules = await prisma.recurringTransaction.findMany({
    include: { category: true, user: { select: { id: true, name: true, color: true } } },
    orderBy: { dayOfMonth: "asc" },
  })
  return NextResponse.json(rules)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, amount, categoryId, dayOfMonth } = await req.json()
  if (!name || !amount || !categoryId || !dayOfMonth) {
    return NextResponse.json({ error: "Fehlende Felder" }, { status: 400 })
  }

  const rule = await prisma.recurringTransaction.create({
    data: {
      name,
      amount: parseFloat(amount),
      categoryId,
      dayOfMonth: parseInt(dayOfMonth),
      userId: session.user.id,
    },
    include: { category: true, user: { select: { id: true, name: true, color: true } } },
  })
  return NextResponse.json(rule)
}
