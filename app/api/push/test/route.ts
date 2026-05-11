import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendPush } from "@/lib/push"
import { NextResponse } from "next/server"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  await sendPush(user.id, "budgetWarning", {
    title: "Test Notification",
    body: "Push funktioniert! 🎉",
    url: "/notifications",
  })
  return NextResponse.json({ ok: true })
}
