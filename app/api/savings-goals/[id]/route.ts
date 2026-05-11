import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { notifyGoalReached } from "@/lib/push-triggers"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { savedAmount } = await req.json()
  const newAmount = parseFloat(savedAmount)

  const before = await prisma.savingsGoal.findUnique({ where: { id } })
  const goal = await prisma.savingsGoal.update({
    where: { id },
    data: { savedAmount: newAmount },
  })

  if (before && before.savedAmount < before.targetAmount && newAmount >= before.targetAmount) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email! } })
    if (user) {
      ;(async () => {
        try { await notifyGoalReached(user.id, goal.name, goal.icon) }
        catch (err) { console.error("goal reached push error", err) }
      })()
    }
  }

  return NextResponse.json(goal)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await prisma.savingsGoal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
