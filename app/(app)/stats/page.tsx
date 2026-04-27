"use client"

import { useEffect, useState } from "react"
import { formatCHF } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

type Transaction = {
  amount: number
  category: { id: string; name: string; icon: string; type: string }
}

type CategoryStat = {
  id: string; name: string; icon: string; type: string; total: number
}

export default function StatsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [tab, setTab] = useState<"expense" | "income">("expense")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/transactions?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(data => { setTransactions(data); setLoading(false) })
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  const filtered = transactions.filter(t => t.category.type === tab)
  const total = filtered.reduce((s, t) => s + t.amount, 0)

  const byCategory: CategoryStat[] = Object.values(
    filtered.reduce((acc, t) => {
      const key = t.category.id
      if (!acc[key]) acc[key] = { ...t.category, total: 0 }
      acc[key].total += t.amount
      return acc
    }, {} as Record<string, CategoryStat>)
  ).sort((a, b) => b.total - a.total)

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("de-CH", { month: "long", year: "numeric" })

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white border-b border-gray-100 px-4 pt-14 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <p className="font-semibold text-gray-900">{monthLabel}</p>
          <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-2xl">
          {(["expense", "income"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-2 rounded-xl text-sm font-semibold transition-all ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-400"}`}>
              {t === "expense" ? "Ausgaben" : "Einnahmen"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
          Total: <span className={tab === "expense" ? "text-red-500" : "text-green-600"}>{formatCHF(total)}</span>
        </p>

        {loading ? (
          <p className="text-center text-gray-400 py-8 text-sm">Laden…</p>
        ) : byCategory.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Keine Buchungen</p>
        ) : (
          <div className="space-y-3">
            {byCategory.map(cat => {
              const pct = total > 0 ? (cat.total / total) * 100 : 0
              return (
                <div key={cat.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{cat.icon}</span>
                    <div className="flex-1 flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${tab === "expense" ? "text-red-500" : "text-green-600"}`}>
                          {formatCHF(cat.total)}
                        </p>
                        <p className="text-xs text-gray-400">{pct.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${tab === "expense" ? "bg-red-400" : "bg-green-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
