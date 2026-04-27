import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatCHF, formatDate } from "@/lib/utils"
import { TrendingUp, TrendingDown, Wallet } from "lucide-react"

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
  const lastEnd = start

  const [transactions, lastMonth] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: start, lt: end } },
      include: { category: true, user: { select: { id: true, name: true, color: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: lastStart, lt: lastEnd } },
      include: { category: true },
    }),
  ])

  const income = transactions.filter(t => t.category.type === "income").reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.category.type === "expense").reduce((s, t) => s + t.amount, 0)
  const balance = income - expenses

  const lastIncome = lastMonth.filter(t => t.category.type === "income").reduce((s, t) => s + t.amount, 0)
  const lastExpenses = lastMonth.filter(t => t.category.type === "expense").reduce((s, t) => s + t.amount, 0)
  const lastBalance = lastIncome - lastExpenses

  const balanceDiff = lastBalance !== 0 ? Math.round(((balance - lastBalance) / Math.abs(lastBalance)) * 100) : null
  const expenseDiff = lastExpenses !== 0 ? Math.round(((expenses - lastExpenses) / Math.abs(lastExpenses)) * 100) : null

  const monthLabel = now.toLocaleDateString("de-CH", { month: "long", year: "numeric" })

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 px-5 pt-14 pb-8">
        <p className="text-green-200 text-sm font-medium">{monthLabel}</p>
        <p className="text-white text-4xl font-bold mt-1">{formatCHF(balance)}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-green-200 text-sm">Bilanz diesen Monat</p>
          {balanceDiff !== null && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${balanceDiff >= 0 ? "bg-green-500/40 text-green-100" : "bg-red-500/40 text-red-100"}`}>
              {balanceDiff >= 0 ? "+" : ""}{balanceDiff}% vs. Vormonat
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 -mt-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium text-gray-500">Einnahmen</span>
          </div>
          <p className="text-lg font-bold text-green-600">{formatCHF(income)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-gray-500">Ausgaben</span>
          </div>
          <p className="text-lg font-bold text-red-500">{formatCHF(expenses)}</p>
          {expenseDiff !== null && (
            <p className={`text-xs mt-0.5 ${expenseDiff <= 0 ? "text-green-500" : "text-red-400"}`}>
              {expenseDiff >= 0 ? "+" : ""}{expenseDiff}% vs. Vormonat
            </p>
          )}
        </div>
      </div>

      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Letzte Buchungen</h2>
        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <Wallet className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Noch keine Buchungen diesen Monat</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 8).map(t => (
              <div key={t.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                <span className="text-2xl">{t.category.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.description || t.category.name}</p>
                    {t.recurringId && <span className="text-xs text-gray-300">↻</span>}
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(t.date)} · {t.user.name}</p>
                </div>
                <p className={`text-sm font-semibold tabular-nums ${t.category.type === "income" ? "text-green-600" : "text-red-500"}`}>
                  {t.category.type === "income" ? "+" : "-"}{formatCHF(t.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
