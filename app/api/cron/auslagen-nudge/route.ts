import { prisma } from "@/lib/prisma"
import { sendPush } from "@/lib/push"
import { checkCronAuth } from "@/lib/cron-auth"
import { formatCHF, CONTRIBUTORS } from "@/lib/utils"
import { NextResponse } from "next/server"

const THRESHOLD_CHF = 100

function periodStartFor(date: Date): Date {
  return date.getDate() >= 24
    ? new Date(date.getFullYear(), date.getMonth(), 24)
    : new Date(date.getFullYear(), date.getMonth() - 1, 24)
}

export async function GET(req: Request) {
  if (!checkCronAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const start = periodStartFor(now)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 24)

  const sharedTxs = await prisma.transaction.findMany({
    where: { date: { gte: start, lt: end }, sharedWith: { not: null } },
    include: { category: true, user: true },
  })
  const expenses = sharedTxs.filter(t => t.category.type === "expense")

  const totals = new Map<string, { userId: string; name: string; total: number }>()
  for (const t of expenses) {
    let key: string
    let userId: string
    let name: string
    if (t.contributor) {
      const contrib = CONTRIBUTORS.find(c => c.value === t.contributor)
      const firstName = contrib?.label.split(" ")[0] ?? t.contributor
      const matched = await prisma.user.findFirst({ where: { name: { contains: firstName } } })
      if (!matched) continue
      key = matched.id
      userId = matched.id
      name = firstName
    } else {
      key = t.user.id
      userId = t.user.id
      name = t.user.name.split(" ")[0]
    }
    if (!totals.has(key)) totals.set(key, { userId, name, total: 0 })
    totals.get(key)!.total += t.amount
  }

  const ranked = Array.from(totals.values()).sort((a, b) => b.total - a.total)
  if (ranked.length < 2) return NextResponse.json({ sent: 0, reason: "not enough payers" })

  const top = ranked[0]
  const bottom = ranked[ranked.length - 1]
  const diff = top.total - bottom.total
  if (diff < THRESHOLD_CHF) return NextResponse.json({ sent: 0, diff, reason: "below threshold" })

  await sendPush(bottom.userId, "turnNudge", {
    title: "Du bist dran 💰",
    body: `${top.name} hat ${formatCHF(diff)} mehr ausgelegt diese Periode`,
    url: "/stats",
    tag: `nudge-${bottom.userId}-${start.toISOString().slice(0, 10)}`,
  })

  return NextResponse.json({ sent: 1, diff })
}
