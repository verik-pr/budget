import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const provisions = await prisma.provision.findMany({ orderBy: { nextDueDate: "asc" } })
  return NextResponse.json(provisions)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name, icon, totalAmount, frequencyMonths, nextDueDate } = await req.json()
  if (!name || !totalAmount || !nextDueDate) {
    return NextResponse.json({ error: "Fehlende Felder" }, { status: 400 })
  }
  const provision = await prisma.provision.create({
    data: {
      id: crypto.randomUUID(),
      name,
      icon: icon || "📅",
      totalAmount: parseFloat(totalAmount),
      frequencyMonths: parseInt(frequencyMonths) || 12,
      nextDueDate,
    },
  })
  return NextResponse.json(provision)
}
