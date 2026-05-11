import { prisma } from "@/lib/prisma"
import { sendPush } from "@/lib/push"
import { checkCronAuth } from "@/lib/cron-auth"
import { NextResponse } from "next/server"

const DAYS_IDLE = 3

export async function GET(req: Request) {
  if (!checkCronAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - DAYS_IDLE)

  const users = await prisma.user.findMany()
  let sent = 0

  for (const user of users) {
    const lastTx = await prisma.transaction.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })
    if (lastTx && lastTx.createdAt > cutoff) continue

    await sendPush(user.id, "scanReminder", {
      title: "Quittungen scannen?",
      body: `Du hast seit ${DAYS_IDLE} Tagen nichts erfasst.`,
      url: "/scan",
      tag: `scan-${user.id}-${new Date().toISOString().slice(0, 10)}`,
    })
    sent++
  }

  return NextResponse.json({ sent, checked: users.length })
}
