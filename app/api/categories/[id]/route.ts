import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { asNonNegativeNumber } from "@/lib/api-validation"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const data: { budget?: number | null } = {}

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

  const category = await prisma.category.update({ where: { id }, data })
  return NextResponse.json(category)
}
