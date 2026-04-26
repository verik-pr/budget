"use client"

import { useEffect, useState } from "react"
import { formatCHF, formatDate } from "@/lib/utils"
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react"

type Transaction = {
  id: string
  date: string
  amount: number
  description: string | null
  category: { id: string; name: string; icon: string; type: string }
  user: { id: string; name: string; color: string }
}

export default function TransactionsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/transactions?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(data => { setTransactions(data); setLoading(false) })
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Buchung löschen?")) return
    await fetch(`/api/transactions/${id}`, { method: "DELETE" })
    setTransactions(ts => ts.filter(t => t.id !== id))
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("de-CH", { month: "long", year: "numeric" })
  const income = transactions.filter(t => t.category.type === "income").reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.category.type === "expense").reduce((s, t) => s + t.amount, 0)

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white border-b border-gray-100 px-4 pt-14 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-center">
            <p className="font-semibold text-gray-900">{monthLabel}</p>
            <p className="text-xs text-gray-400">
              <span className="text-green-600">+{formatCHF(income)}</span>
              {" · "}
              <span className="text-red-500">-{formatCHF(expenses)}</span>
            </p>
          </div>
          <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-2">
        {loading ? (
          <p className="text-center text-gray-400 py-8 text-sm">Laden…</p>
        ) : transactions.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Keine Buchungen in diesem Monat</p>
        ) : transactions.map(t => (
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
            <button
              onClick={() => deleteTransaction(t.id)}
              className="text-gray-300 hover:text-red-400 active:text-red-500 p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
