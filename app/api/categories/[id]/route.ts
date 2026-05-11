import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const data: { budget?: number | null } = {}

  if ("budget" in body) {
    const b = body.budget
    data.budget = b === null || b === "" || b === undefined ? null : parseFloat(b)
  }

  const category = await prisma.category.update({ where: { id }, data })
  return NextResponse.json(category)
}
