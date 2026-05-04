import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { category: true, user: { select: { id: true, name: true } }, account: true },
  })
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(transaction)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { amount, categoryId, description, date, contributor, accountId, sharedWith, sharedRatio } = body

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(categoryId !== undefined && { categoryId }),
      ...(description !== undefined && { description: description || null }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(contributor !== undefined && { contributor: contributor || null }),
      ...(accountId !== undefined && { accountId: accountId || null }),
      ...(sharedWith !== undefined && { sharedWith: sharedWith || null }),
      ...(sharedRatio !== undefined && { sharedRatio: sharedRatio ?? null }),
    },
  })
  return NextResponse.json(transaction)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await prisma.transaction.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
