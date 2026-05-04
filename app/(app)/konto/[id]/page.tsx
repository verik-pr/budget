"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { formatCHF, formatDate } from "@/lib/utils"

type Transaction = {
  id: string; date: string; amount: number; description: string | null
  category: { name: string; icon: string; type: string }
  user: { id: string; name: string; color: string }
}

type Account = { id: string; name: string; icon: string; color: string }

export default function KontoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/accounts").then(r => r.json()).then((accs: Account[]) => {
      setAccount(accs.find(a => a.id === id) ?? null)
    })
  }, [id])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/transactions?year=${year}&month=${month}&accountId=${id}`)
      .then(r => r.json())
      .then(data => { setTransactions(data); setLoading(false) })
  }, [year, month, id])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  const expenses = transactions.filter(t => t.category.type === "expense")
  const total = expenses.reduce((s, t) => s + t.amount, 0)
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("de-CH", { month: "long", year: "numeric" })

  // Group by user
  const byUser: Record<string, { name: string; color: string; total: number }> = {}
  for (const t of expenses) {
    if (!byUser[t.user.id]) byUser[t.user.id] = { name: t.user.name, color: t.user.color, total: 0 }
    byUser[t.user.id].total += t.amount
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-black px-6 pt-safe pb-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          {account && (
            <div className="flex items-center gap-2">
              <span className="text-xl">{account.icon}</span>
              <p className="text-white font-bold">{account.name}</p>
            </div>
          )}
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="text-zinc-400 text-sm font-semibold">{monthLabel}</p>
          <button onClick={nextMonth} className="text-zinc-400 hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Total */}
        <p className="text-white text-4xl font-black tracking-tight tabular-nums">−{formatCHF(total)}</p>
        <p className="text-zinc-600 text-sm mt-1">Ausgaben</p>

        {/* Split by user */}
        {Object.keys(byUser).length > 1 && (
          <div className="flex gap-4 mt-6">
            {Object.values(byUser).map(u => (
              <div key={u.name}>
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">{u.name}</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: u.color }}>−{formatCHF(u.total)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="px-6 py-4">
        {loading ? (
          <p className="text-center text-zinc-400 py-8 text-sm">Laden…</p>
        ) : transactions.length === 0 ? (
          <p className="text-center text-zinc-400 py-8 text-sm">Keine Buchungen diesen Monat</p>
        ) : (
          <div className="bg-white rounded-3xl overflow-hidden">
            {transactions.map((t, i) => (
              <div key={t.id} className={`flex items-center gap-4 px-5 py-4 ${i < transactions.length - 1 ? "border-b border-gray-100" : ""}`}>
                <span className="text-2xl w-8 text-center">{t.category.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{t.description || t.category.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(t.date)}
                    <span className="mx-1">·</span>
                    <span style={{ color: t.user.color }} className="font-semibold">{t.user.name}</span>
                  </p>
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
