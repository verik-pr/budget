import { prisma } from "@/lib/prisma"
import { sendPush } from "@/lib/push"
import { checkCronAuth } from "@/lib/cron-auth"
import { formatCHF, CONTRIBUTORS } from "@/lib/utils"
import { NextResponse } from "next/server"

const DAYS_BEFORE = 3

export async function GET(req: Request) {
  if (!checkCronAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = new Date()
  const target = new Date(today)
  target.setDate(today.getDate() + DAYS_BEFORE)
  const targetDay = target.getDate()

  const cards = await prisma.account.findMany({ where: { type: "credit", dueDay: targetDay } })
  if (cards.length === 0) return NextResponse.json({ sent: 0, reason: "no cards due" })

  const users = await prisma.user.findMany()
  let sent = 0

  for (const card of cards) {
    const start = new Date(today.getFullYear(), today.getMonth() - 2, 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    const txs = await prisma.transaction.findMany({
      where: { accountId: card.id, date: { gte: start, lt: end } },
      select: { amount: true },
    })
    const balance = txs.reduce((s, t) => s + t.amount, 0)
    if (balance <= 0) continue

    const recipients = card.ownerName
      ? users.filter(u => u.name.toLowerCase().includes(card.ownerName!.toLowerCase()))
      : users.filter(u => CONTRIBUTORS.some(c => u.name.toLowerCase().includes(c.label.split(" ")[0].toLowerCase()) && (c.value === "erik" || c.value === "celine")))

    for (const user of recipients) {
      await sendPush(user.id, "creditCardDue", {
        title: `${card.icon} ${card.name} fällig in ${DAYS_BEFORE} Tagen`,
        body: `Offen: ${formatCHF(balance)}`,
        url: "/kreditkarten",
        tag: `creditcard-${card.id}-${today.toISOString().slice(0, 10)}`,
      })
      sent++
    }
  }

  return NextResponse.json({ sent, checked: cards.length })
}
