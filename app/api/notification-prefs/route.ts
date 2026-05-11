import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

const FLAGS = ["budgetWarning", "creditCardDue", "partnerBooking", "turnNudge", "goalReached", "scanReminder"] as const

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const prefs = await prisma.notificationPrefs.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  })
  return NextResponse.json(prefs)
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  const data: Record<string, boolean> = {}
  for (const flag of FLAGS) {
    if (flag in body) data[flag] = Boolean(body[flag])
  }

  const prefs = await prisma.notificationPrefs.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  })
  return NextResponse.json(prefs)
}
