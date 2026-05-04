import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get("accountId")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  let start: Date, end: Date
  if (startDate && endDate) {
    start = new Date(startDate)
    end = new Date(endDate)
  } else {
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1))
    start = new Date(year, month - 1, 1)
    end = new Date(year, month, 1)
  }

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start, lt: end }, ...(accountId ? { accountId } : {}) },
    include: { category: true, user: { select: { id: true, name: true, color: true } }, account: { select: { id: true, name: true, icon: true, color: true } } },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(transactions)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { date, amount, description, categoryId, photoPath, contributor, accountId, sharedWith, sharedRatio } = body

  if (!date || !amount || !categoryId) {
    return NextResponse.json({ error: "Fehlende Felder" }, { status: 400 })
  }

  const transaction = await prisma.transaction.create({
    data: {
      date: new Date(date),
      amount: parseFloat(amount),
      description: description || null,
      photoPath: photoPath || null,
      categoryId,
      userId: session.user.id,
      contributor: contributor || null,
      accountId: accountId || null,
      ...(sharedWith ? { sharedWith, sharedRatio: sharedRatio ?? null } : {}),
    },
    include: { category: true, user: { select: { id: true, name: true, color: true } } },
  })

  return NextResponse.json(transaction)
}
