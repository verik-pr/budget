import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { asDateOnlyString, asIntegerInRange, asNonEmptyString, asNullableString, asPositiveNumber } from "@/lib/api-validation"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { name, icon, totalAmount, frequencyMonths, nextDueDate } = await req.json()
  const parsedName = name !== undefined ? asNonEmptyString(name) : undefined
  const parsedAmount = totalAmount !== undefined ? asPositiveNumber(totalAmount) : undefined
  const parsedFrequency = frequencyMonths !== undefined ? asIntegerInRange(frequencyMonths, 1, 120) : undefined
  const parsedNextDueDate = nextDueDate !== undefined ? asDateOnlyString(nextDueDate) : undefined

  if (parsedName === null) return NextResponse.json({ error: "Ungültiger Name" }, { status: 400 })
  if (parsedAmount === null) return NextResponse.json({ error: "Ungültiger Betrag" }, { status: 400 })
  if (parsedFrequency === null) return NextResponse.json({ error: "Ungültige Frequenz" }, { status: 400 })
  if (parsedNextDueDate === null) return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 })

  const provision = await prisma.provision.update({
    where: { id },
    data: {
      ...(parsedName !== undefined && { name: parsedName }),
      ...(icon !== undefined && { icon: asNullableString(icon) || "📅" }),
      ...(parsedAmount !== undefined && { totalAmount: parsedAmount }),
      ...(parsedFrequency !== undefined && { frequencyMonths: parsedFrequency }),
      ...(parsedNextDueDate !== undefined && { nextDueDate: parsedNextDueDate }),
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
