import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { asIntegerInRange, asNonEmptyString, asNullableString } from "@/lib/api-validation"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { name, icon, color, dueDay, ownerName } = await req.json()
  const parsedDueDay = dueDay === null || dueDay === undefined || dueDay === "" ? null : asIntegerInRange(dueDay, 1, 31)
  if (dueDay !== undefined && parsedDueDay === null && dueDay !== null && dueDay !== "") {
    return NextResponse.json({ error: "Ungültiger Fälligkeitstag" }, { status: 400 })
  }
  if (name !== undefined && !asNonEmptyString(name)) {
    return NextResponse.json({ error: "Ungültiger Name" }, { status: 400 })
  }
  const account = await prisma.account.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: asNonEmptyString(name)! }),
      ...(icon !== undefined && { icon: asNullableString(icon) || "💳" }),
      ...(color !== undefined && { color: asNullableString(color) || "#6366f1" }),
      ...(dueDay !== undefined && { dueDay: parsedDueDay }),
      ...(ownerName !== undefined && { ownerName: asNullableString(ownerName) }),
    },
  })
  return NextResponse.json(account)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const transactionCount = await prisma.transaction.count({ where: { accountId: id } })
  if (transactionCount > 0) {
    return NextResponse.json({ error: "Konto kann nicht gelöscht werden, solange Buchungen verknüpft sind" }, { status: 409 })
  }
  await prisma.account.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
