"use client"

import { useEffect, useState } from "react"
import { formatCHF } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CONTRIBUTORS } from "@/lib/utils"
import { useSession } from "next-auth/react"

type Transaction = {
  amount: number
  contributor: string | null
  user: { name: string }
  category: { id: string; name: string; icon: string; type: string }
}

type CategoryStat = { id: string; name: string; icon: string; type: string; total: number }
type Account = { id: string; name: string; icon: string; color: string }
type PersonStat = { label: string; color: string; total: number }

function initialPeriodStart() {
  const today = new Date()
  return today.getDate() >= 24
    ? new Date(today.getFullYear(), today.getMonth(), 24)
    : new Date(today.getFullYear(), today.getMonth() - 1, 24)
}

export default function StatsPage() {
  const { data: session } = useSession()
  const [periodStart, setPeriodStart] = useState<Date>(initialPeriodStart)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [tab, setTab] = useState<"expense" | "income">("expense")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/accounts?mine=true")
      .then(r => r.json())
      .then(({ accounts: accs, defaultId }: { accounts: Account[]; defaultId: string | null }) => {
        setAccounts(accs)
        setAccountId(defaultId)
      })
  }, [])

  useEffect(() => {
    if (accountId === undefined) return
    setLoading(true)
    const end = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 24)
    const params = new URLSearchParams({
      startDate: periodStart.toISOString(),
      endDate: end.toISOString(),
      ...(accountId ? { accountId } : {}),
    })
    fetch(`/api/transactions?${params}`)
      .then(r => r.json())
      .then(data => { setTransactions(data); setLoading(false) })
  }, [periodStart, accountId])

  function prevPeriod() {
    setPeriodStart(p => new Date(p.getFullYear(), p.getMonth() - 1, 24))
  }
  function nextPeriod() {
    setPeriodStart(p => new Date(p.getFullYear(), p.getMonth() + 1, 24))
  }

  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 24)
  const lastDay = new Date(periodEnd.getTime() - 86400000)
  const periodLabel = `${periodStart.getDate()}. ${periodStart.toLocaleDateString("de-CH", { month: "short" })} – ${lastDay.getDate()}. ${lastDay.toLocaleDateString("de-CH", { month: "short", year: "numeric" })}`

  const expenses = transactions.filter(t => t.category.type === "expense")
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

  // Per-person spending (expenses only)
  const myName = session?.user?.name?.split(" ")[0] ?? "Ich"
  const byPerson: PersonStat[] = (() => {
    const map: Record<string, PersonStat> = {}
    for (const t of expenses) {
      const key = t.contributor ?? "__me__"
      if (!map[key]) {
        const contrib = CONTRIBUTORS.find(c => c.value === t.contributor)
        map[key] = {
          label: contrib ? contrib.label.split(" ")[0] : myName,
          color: contrib?.color ?? "#6366f1",
          total: 0,
        }
      }
      map[key].total += t.amount
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  })()

  const personTotal = byPerson.reduce((s, p) => s + p.total, 0)

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-black px-6 pt-safe pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevPeriod} className="text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="text-white font-bold text-sm">{periodLabel}</p>
          <button onClick={nextPeriod} className="text-zinc-400 hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {accounts.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {accounts.map(acc => (
              <button key={acc.id} type="button"
                onClick={() => setAccountId(acc.id)}
                style={accountId === acc.id ? { backgroundColor: acc.color } : {}}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${accountId === acc.id ? "text-white" : "bg-zinc-800 text-zinc-400"}`}>
                <span>{acc.icon}</span>
                <span>{acc.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {(["expense", "income"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${tab === t ? "bg-white text-black" : "bg-zinc-900 text-zinc-500"}`}>
              {t === "expense" ? "Ausgaben" : "Einnahmen"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pt-6 space-y-6 pb-8">

        {/* Per-person breakdown */}
        {!loading && byPerson.length > 1 && (
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Wer hat mehr ausgegeben</p>
            <div className="bg-white rounded-3xl overflow-hidden">
              {byPerson.map((p, i) => {
                const pct = personTotal > 0 ? (p.total / personTotal) * 100 : 0
                return (
                  <div key={p.label} className={`px-5 py-4 ${i < byPerson.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                        style={{ backgroundColor: p.color }}>
                        {p.label[0]}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 flex-1">{p.label}</p>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900 tabular-nums">{formatCHF(p.total)}</p>
                        <p className="text-xs text-gray-400">{pct.toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: p.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Category breakdown */}
        <div>
          <div className="flex items-baseline gap-2 mb-3">
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
    </div>
  )
}
