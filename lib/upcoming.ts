import { prisma } from "./prisma"
import { creditCardBalanceOf } from "./utils"

export type UpcomingItem = {
  date: Date
  icon: string
  name: string
  amount: number
  kind: "provision" | "credit" | "recurring"
}

// Bagatellgrenze für Regeln im Radar — kleine Abos sollen die Karte nicht fluten
const RECURRING_MIN_CHF = 100

function clampToMonth(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
}

// Nächstes Vorkommen eines Monatstags (dueDay 29–31 wird auf Monatsende geklemmt)
function nextOccurrence(day: number, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thisMonth = clampToMonth(now.getFullYear(), now.getMonth(), day)
  return thisMonth >= today ? thisMonth : clampToMonth(now.getFullYear(), now.getMonth() + 1, day)
}

// Offener Kreditkarten-Saldo: Ausgaben minus Zahlungen der letzten ~3 Monate
// (gleiche Logik wie der Kreditkarten-Fälligkeits-Cron)
export async function getCreditCardOpenBalance(accountId: string, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const txs = await prisma.transaction.findMany({
    where: { accountId, date: { gte: start, lt: end } },
    select: { amount: true, category: { select: { type: true } } },
  })
  return creditCardBalanceOf(txs)
}

// Alle bekannten Zahlungen der nächsten `horizonDays` Tage:
// Rückstellungen, Kreditkarten-Fälligkeiten mit offenem Saldo, grosse Regeln
export async function getUpcomingPayments(now = new Date(), horizonDays = 30): Promise<UpcomingItem[]> {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const horizon = new Date(todayStart.getTime() + horizonDays * 86400000)
  const items: UpcomingItem[] = []

  const [provisions, creditCards, rules] = await Promise.all([
    prisma.provision.findMany(),
    prisma.account.findMany({ where: { type: "credit" } }),
    prisma.recurringTransaction.findMany({ where: { active: true }, include: { category: true } }),
  ])

  for (const p of provisions) {
    const due = new Date(`${p.nextDueDate}T00:00:00`)
    if (!Number.isNaN(due.getTime()) && due >= todayStart && due <= horizon) {
      items.push({ date: due, icon: p.icon, name: p.name, amount: p.totalAmount, kind: "provision" })
    }
  }

  for (const card of creditCards) {
    if (!card.dueDay) continue
    const due = nextOccurrence(card.dueDay, now)
    if (due > horizon) continue
    const balance = await getCreditCardOpenBalance(card.id, now)
    if (balance > 0.005) {
      items.push({ date: due, icon: card.icon, name: card.name, amount: balance, kind: "credit" })
    }
  }

  for (const rule of rules) {
    if (rule.category.type !== "expense" || rule.amount < RECURRING_MIN_CHF) continue
    const due = nextOccurrence(rule.dayOfMonth, now)
    if (due <= horizon) {
      items.push({ date: due, icon: rule.category.icon, name: rule.name, amount: rule.amount, kind: "recurring" })
    }
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime())
}
