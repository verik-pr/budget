import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await prisma.recurringTransaction.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const data: { active?: boolean; accountId?: string | null } = {}

  if ("active" in body) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 })
    }
    data.active = body.active
  }

  // Konto nachträglich zuweisen/entfernen (z.B. Miete aufs Gemeinsame Konto)
  if ("accountId" in body) {
    if (body.accountId === null || body.accountId === "") {
      data.accountId = null
    } else if (typeof body.accountId === "string") {
      const account = await prisma.account.findUnique({ where: { id: body.accountId } })
      if (!account) return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 400 })
      data.accountId = body.accountId
    } else {
      return NextResponse.json({ error: "Ungültiges Konto" }, { status: 400 })
    }
  }

  const rule = await prisma.recurringTransaction.update({
    where: { id },
    data,
    include: {
      category: true,
      user: { select: { id: true, name: true, color: true } },
      account: { select: { id: true, name: true, icon: true, color: true } },
    },
  })
  return NextResponse.json(rule)
}
