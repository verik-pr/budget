"use client"

import { useEffect, useState } from "react"
import { formatCHF, formatDate } from "@/lib/utils"
import { Trash2, ChevronLeft, ChevronRight, Search, Image } from "lucide-react"

type Transaction = {
  id: string; date: string; amount: number; description: string | null; photoPath: string | null
  category: { id: string; name: string; icon: string; type: string }
  user: { id: string; name: string; color: string }
}

export default function TransactionsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all")
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<string | null>(null)

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

  async function deleteTransaction(id: string) {
    if (!confirm("Buchung löschen?")) return
    await fetch(`/api/transactions/${id}`, { method: "DELETE" })
    setTransactions(ts => ts.filter(t => t.id !== id))
  }

  const visible = transactions
    .filter(t => filterType === "all" || t.category.type === filterType)
    .filter(t => !search || (t.description || t.category.name).toLowerCase().includes(search.toLowerCase()))

  const income = transactions.filter(t => t.category.type === "income").reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.category.type === "expense").reduce((s, t) => s + t.amount, 0)
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("de-CH", { month: "long", year: "numeric" })

  return (
    <div className="max-w-lg mx-auto">
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={`/api/photos/${lightbox}`} className="max-w-full max-h-full rounded-2xl" alt="" />
        </div>
      )}

      <div className="bg-black px-6 pt-safe pb-6 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-white font-bold">{monthLabel}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              <span className="text-green-400">+{formatCHF(income)}</span>
              <span className="mx-1.5 text-zinc-700">·</span>
              <span className="text-zinc-300">−{formatCHF(expenses)}</span>
            </p>
          </div>
          <button onClick={nextMonth} className="text-zinc-400 hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600" />
        </div>

        <div className="flex gap-2">
          {(["all", "expense", "income"] as const).map(f => (
            <button key={f} onClick={() => setFilterType(f)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${filterType === f ? "bg-white text-black" : "bg-zinc-900 text-zinc-500"}`}>
              {f === "all" ? "Alle" : f === "expense" ? "Ausgaben" : "Einnahmen"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <p className="text-center text-zinc-400 py-8 text-sm">Laden…</p>
        ) : visible.length === 0 ? (
          <p className="text-center text-zinc-400 py-8 text-sm">Keine Buchungen gefunden</p>
        ) : (
          <div className="bg-white rounded-3xl overflow-hidden">
            {visible.map((t, i) => (
              <div key={t.id} className={i < visible.length - 1 ? "border-b border-gray-100" : ""}>
                <div className="flex items-center gap-4 px-5 py-4">
                  <span className="text-2xl w-8 text-center">{t.category.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.description || t.category.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(t.date)} · {t.user.name}</p>
                  </div>
                  <p className={`text-sm font-bold tabular-nums ${t.category.type === "income" ? "text-green-500" : "text-gray-900"}`}>
                    {t.category.type === "income" ? "+" : "−"}{formatCHF(t.amount)}
                  </p>
                  {t.photoPath && (
                    <button onClick={() => setLightbox(t.photoPath!)} className="text-gray-300 hover:text-blue-400 p-1">
                      <Image className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => deleteTransaction(t.id)} className="text-gray-200 hover:text-red-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {t.photoPath && (
                  <button onClick={() => setLightbox(t.photoPath!)} className="block w-full">
                    <img src={`/api/photos/${t.photoPath}`} className="w-full h-32 object-cover" alt="Quittung" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
