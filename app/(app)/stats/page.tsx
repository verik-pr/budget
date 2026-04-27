"use client"

import { useEffect, useState } from "react"
import { formatCHF } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

type Transaction = {
  amount: number
  category: { id: string; name: string; icon: string; type: string }
}

type CategoryStat = { id: string; name: string; icon: string; type: string; total: number }

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
      <div className="bg-black px-6 pt-safe pb-6 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-5">
          <button onClick={prevMonth} className="text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="text-white font-bold">{monthLabel}</p>
          <button onClick={nextMonth} className="text-zinc-400 hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2">
          {(["expense", "income"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${tab === t ? "bg-white text-black" : "bg-zinc-900 text-zinc-500"}`}>
              {t === "expense" ? "Ausgaben" : "Einnahmen"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pt-6">
        <div className="flex items-baseline gap-2 mb-6">
          <p className="text-3xl font-black text-gray-900 tabular-nums">{formatCHF(total)}</p>
          <p className="text-sm text-zinc-400 font-medium">Total</p>
        </div>

        {loading ? (
          <p className="text-center text-zinc-400 py-8 text-sm">Laden…</p>
        ) : byCategory.length === 0 ? (
          <p className="text-center text-zinc-400 py-8 text-sm">Keine Buchungen</p>
        ) : (
          <div className="bg-white rounded-3xl overflow-hidden">
            {byCategory.map((cat, i) => {
              const pct = total > 0 ? (cat.total / total) * 100 : 0
              return (
                <div key={cat.id} className={`px-5 py-4 ${i < byCategory.length - 1 ? "border-b border-gray-100" : ""}`}>
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="text-xl w-7 text-center">{cat.icon}</span>
                    <p className="text-sm font-semibold text-gray-900 flex-1">{cat.name}</p>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 tabular-nums">{formatCHF(cat.total)}</p>
                      <p className="text-xs text-gray-400">{pct.toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${tab === "expense" ? "bg-gray-900" : "bg-green-500"}`}
                      style={{ width: `${pct}%` }} />
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
