import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { asIntegerInRange, asNonEmptyString, asPositiveNumber } from "@/lib/api-validation"

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
  const parsedName = asNonEmptyString(name)
  const parsedAmount = asPositiveNumber(amount)
  const parsedDay = asIntegerInRange(dayOfMonth, 1, 31)
  if (!parsedName || parsedAmount === null || !categoryId || parsedDay === null) {
    return NextResponse.json({ error: "Fehlende Felder" }, { status: 400 })
  }

  const currentUser = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!currentUser) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 })
  const category = await prisma.category.findUnique({ where: { id: categoryId } })
  if (!category) return NextResponse.json({ error: "Kategorie nicht gefunden" }, { status: 400 })

  const rule = await prisma.recurringTransaction.create({
    data: {
      name: parsedName,
      amount: parsedAmount,
      categoryId,
      dayOfMonth: parsedDay,
      userId: currentUser.id,
    },
    include: { category: true, user: { select: { id: true, name: true, color: true } } },
  })
  return NextResponse.json(rule)
}
