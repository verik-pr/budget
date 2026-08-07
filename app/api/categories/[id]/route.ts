import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { asNonEmptyString, asNonNegativeNumber } from "@/lib/api-validation"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const data: { budget?: number | null; name?: string; icon?: string } = {}

  if ("budget" in body) {
    const b = body.budget
    if (b === null || b === "" || b === undefined) {
      data.budget = null
    } else {
      const budget = asNonNegativeNumber(b)
      if (budget === null) return NextResponse.json({ error: "Ungültiges Budget" }, { status: 400 })
      data.budget = budget
    }
  }

  if ("name" in body) {
    const name = asNonEmptyString(body.name)
    if (!name || name.length > 40) return NextResponse.json({ error: "Ungültiger Name" }, { status: 400 })
    const duplicate = await prisma.category.findFirst({ where: { name, id: { not: id } } })
    if (duplicate) return NextResponse.json({ error: "Kategorie existiert bereits" }, { status: 409 })
    data.name = name
  }

  if ("icon" in body) {
    const icon = asNonEmptyString(body.icon)
    if (!icon || icon.length > 8) return NextResponse.json({ error: "Ungültiges Icon" }, { status: 400 })
    data.icon = icon
  }

  const category = await prisma.category.update({ where: { id }, data })
  return NextResponse.json(category)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const [txCount, ruleCount] = await Promise.all([
    prisma.transaction.count({ where: { categoryId: id } }),
    prisma.recurringTransaction.count({ where: { categoryId: id } }),
  ])
  if (txCount > 0 || ruleCount > 0) {
    return NextResponse.json({
      error: `Kategorie wird verwendet (${txCount} Buchungen${ruleCount > 0 ? `, ${ruleCount} Regeln` : ""})`,
    }, { status: 409 })
  }

  await prisma.category.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
