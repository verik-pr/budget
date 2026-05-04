import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function auth(req: NextRequest) {
  const key = process.env.AGENT_API_KEY
  if (!key) return false
  const header = req.headers.get("authorization") ?? ""
  return header === `Bearer ${key}`
}

// GET /api/agent — list categories, accounts, recent transactions
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [categories, accounts, transactions] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.findMany({
      take: 20,
      orderBy: { date: "desc" },
      include: { category: true, account: { select: { name: true } } },
    }),
  ])

  return NextResponse.json({ categories, accounts, transactions })
}

// POST /api/agent — create a transaction
// Body: { amount, description, date?, categoryId?, categoryName?, contributor?, accountId?, accountName? }
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { amount, description, date, categoryId, categoryName, contributor, accountId, accountName, userEmail } = body

  if (!amount || amount <= 0) return NextResponse.json({ error: "amount required" }, { status: 400 })

  // Resolve category
  let resolvedCategoryId = categoryId
  if (!resolvedCategoryId && categoryName) {
    const cats = await prisma.category.findMany()
    const cat = cats.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
    if (!cat) return NextResponse.json({ error: `Kategorie "${categoryName}" nicht gefunden` }, { status: 400 })
    resolvedCategoryId = cat.id
  }
  if (!resolvedCategoryId) return NextResponse.json({ error: "categoryId oder categoryName required" }, { status: 400 })

  // Resolve account
  let resolvedAccountId = accountId ?? null
  if (!resolvedAccountId && accountName) {
    const accs = await prisma.account.findMany()
    const acc = accs.find(a => a.name.toLowerCase() === accountName.toLowerCase())
    resolvedAccountId = acc?.id ?? null
  }

  // Resolve user
  const user = userEmail
    ? await prisma.user.findUnique({ where: { email: userEmail } })
    : await prisma.user.findFirst()
  if (!user) return NextResponse.json({ error: "Kein Benutzer gefunden" }, { status: 500 })

  const transaction = await prisma.transaction.create({
    data: {
      amount: parseFloat(String(amount)),
      description: description ?? null,
      date: date ? new Date(date) : new Date(),
      categoryId: resolvedCategoryId,
      userId: user.id,
      contributor: contributor ?? null,
      accountId: resolvedAccountId,
    },
    include: { category: true, account: { select: { name: true } } },
  })

  return NextResponse.json({ ok: true, transaction }, { status: 201 })
}
