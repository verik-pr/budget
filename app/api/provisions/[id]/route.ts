import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { name, icon, totalAmount, frequencyMonths, nextDueDate } = await req.json()
  const provision = await prisma.provision.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(icon !== undefined && { icon }),
      ...(totalAmount !== undefined && { totalAmount: parseFloat(totalAmount) }),
      ...(frequencyMonths !== undefined && { frequencyMonths: parseInt(frequencyMonths) }),
      ...(nextDueDate !== undefined && { nextDueDate }),
    },
  })
  return NextResponse.json(provision)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  await prisma.provision.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
