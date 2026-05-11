import { prisma } from "@/lib/prisma"
import { sendPush } from "@/lib/push"
import { checkCronAuth } from "@/lib/cron-auth"
import { generateWeeklySummary } from "@/lib/ai"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  if (!checkCronAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const users = await prisma.user.findMany()
  const today = new Date().toISOString().slice(0, 10)
  let sent = 0

  for (const user of users) {
    try {
      const summary = await generateWeeklySummary(user.id)
      if (!summary) continue
      await sendPush(user.id, "weeklySummary", {
        title: "Wochen-Rückblick 📊",
        body: summary,
        url: "/stats",
        tag: `weekly-${user.id}-${today}`,
      })
      sent++
    } catch (err) {
      console.error("weekly summary error", err)
    }
  }

  return NextResponse.json({ sent, checked: users.length })
}
