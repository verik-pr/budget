import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatCHF, formatDate } from "@/lib/utils"
import Link from "next/link"

async function applyRecurring() {
  const now = new Date()
  const today = now.getDate()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const rules = await prisma.recurringTransaction.findMany({ where: { active: true } })
  for (const rule of rules) {
    if (rule.dayOfMonth > today) continue
    const already = await prisma.transaction.findFirst({
      where: { recurringId: rule.id, date: { gte: start, lt: end } },
    })
    if (already) continue
    await prisma.transaction.create({
      data: {
        date: new Date(now.getFullYear(), now.getMonth(), rule.dayOfMonth),
        amount: rule.amount,
        description: rule.name,
        categoryId: rule.categoryId,
        userId: rule.userId,
        recurringId: rule.id,
      },
    })
  }
}

export default async function DashboardPage() {
  await applyRecurring()

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [transactions, lastMonth] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: start, lt: end } },
      include: { category: true, user: { select: { id: true, name: true, color: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: lastStart, lt: start } },
      include: { category: true },
    }),
  ])

  const income = transactions.filter(t => t.category.type === "income").reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.category.type === "expense").reduce((s, t) => s + t.amount, 0)
  const balance = income - expenses

  const lastExpenses = lastMonth.filter(t => t.category.type === "expense").reduce((s, t) => s + t.amount, 0)
  const expenseDiff = lastExpenses !== 0 ? Math.round(((expenses - lastExpenses) / Math.abs(lastExpenses)) * 100) : null

  const monthLabel = now.toLocaleDateString("de-CH", { month: "long", year: "numeric" })

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-black px-6 pt-safe pb-10">
        <p className="text-zinc-500 text-xs font-semibold tracking-widest uppercase mb-6">{monthLabel}</p>
        <p className="text-white text-5xl font-black tracking-tight tabular-nums">
          {formatCHF(balance)}
        </p>
        <p className="text-zinc-600 text-sm mt-2">Bilanz</p>

        <div className="flex gap-6 mt-8">
          <div>
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">Einnahmen</p>
            <p className="text-green-400 text-xl font-bold tabular-nums">+{formatCHF(income)}</p>
          </div>
          <div className="w-px bg-zinc-800" />
          <div>
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">Ausgaben</p>
            <p className="text-white text-xl font-bold tabular-nums">−{formatCHF(expenses)}</p>
            {expenseDiff !== null && (
              <p className={`text-xs mt-0.5 font-medium ${expenseDiff <= 0 ? "text-green-500" : "text-red-400"}`}>
                {expenseDiff >= 0 ? "+" : ""}{expenseDiff}% vs. Vormonat
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Letzte Buchungen</p>
          <Link href="/transactions" className="text-xs font-semibold text-green-500">Alle</Link>
        </div>

        {transactions.length === 0 ? (
          <p className="text-zinc-500 text-sm py-8 text-center">Noch keine Buchungen diesen Monat</p>
        ) : (
          <div className="bg-white rounded-3xl overflow-hidden">
            {transactions.slice(0, 8).map((t, i) => (
              <div key={t.id} className={`flex items-center gap-4 px-5 py-4 ${i < Math.min(transactions.length, 8) - 1 ? "border-b border-gray-100" : ""}`}>
                <span className="text-2xl w-8 text-center">{t.category.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {t.description || t.category.name}
                    {t.recurringId && <span className="text-gray-300 ml-1 font-normal">↻</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(t.date)} · {t.user.name}</p>
                </div>
                <p className={`text-sm font-bold tabular-nums ${t.category.type === "income" ? "text-green-500" : "text-gray-900"}`}>
                  {t.category.type === "income" ? "+" : "−"}{formatCHF(t.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
