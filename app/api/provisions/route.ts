import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { asDateOnlyString, asIntegerInRange, asNonEmptyString, asNullableString, asPositiveNumber } from "@/lib/api-validation"

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
  const parsedName = asNonEmptyString(name)
  const parsedAmount = asPositiveNumber(totalAmount)
  const parsedFrequency = frequencyMonths === undefined || frequencyMonths === null || frequencyMonths === ""
    ? 12
    : asIntegerInRange(frequencyMonths, 1, 120)
  const parsedNextDueDate = asDateOnlyString(nextDueDate)
  if (!parsedName || parsedAmount === null || parsedFrequency === null || !parsedNextDueDate) {
    return NextResponse.json({ error: "Fehlende Felder" }, { status: 400 })
  }
  const provision = await prisma.provision.create({
    data: {
      id: crypto.randomUUID(),
      name: parsedName,
      icon: asNullableString(icon) || "📅",
      totalAmount: parsedAmount,
      frequencyMonths: parsedFrequency,
      nextDueDate: parsedNextDueDate,
    },
  })
  return NextResponse.json(provision)
}
