import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatCHF, formatDate } from "@/lib/utils"
import { TrendingUp, TrendingDown, Wallet } from "lucide-react"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)!
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    include: { category: true, user: { select: { id: true, name: true, color: true } } },
    orderBy: { date: "desc" },
  })

  const income = transactions.filter(t => t.category.type === "income").reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.category.type === "expense").reduce((s, t) => s + t.amount, 0)
  const balance = income - expenses

  const monthLabel = now.toLocaleDateString("de-CH", { month: "long", year: "numeric" })

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 px-5 pt-14 pb-8">
        <p className="text-green-200 text-sm font-medium">{monthLabel}</p>
        <p className="text-white text-4xl font-bold mt-1">{formatCHF(balance)}</p>
        <p className="text-green-200 text-sm mt-1">Bilanz diesen Monat</p>
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
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {t.description || t.category.name}
                  </p>
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
