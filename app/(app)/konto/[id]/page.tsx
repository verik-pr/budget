"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react"
import { formatCHF, formatDate } from "@/lib/utils"
import { SkeletonList } from "@/components/skeleton"

type Transaction = {
  id: string; date: string; amount: number; description: string | null
  category: { name: string; icon: string; type: string }
  user: { id: string; name: string; color: string }
}

type Account = { id: string; name: string; icon: string; color: string }

function initialPeriodStart() {
  const today = new Date()
  return today.getDate() >= 24
    ? new Date(today.getFullYear(), today.getMonth(), 24)
    : new Date(today.getFullYear(), today.getMonth() - 1, 24)
}

export default function KontoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [periodStart, setPeriodStart] = useState<Date>(initialPeriodStart)
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
    const end = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 24)
    const params = new URLSearchParams({
      startDate: periodStart.toISOString(),
      endDate: end.toISOString(),
      accountId: id,
    })
    fetch(`/api/transactions?${params}`)
      .then(r => r.json())
      .then(data => { setTransactions(data); setLoading(false) })
  }, [periodStart, id])

  function prevPeriod() { setPeriodStart(p => new Date(p.getFullYear(), p.getMonth() - 1, 24)) }
  function nextPeriod() { setPeriodStart(p => new Date(p.getFullYear(), p.getMonth() + 1, 24)) }

  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 24)
  const lastDay = new Date(periodEnd.getTime() - 86400000)
  const periodLabel = `${periodStart.getDate()}. ${periodStart.toLocaleDateString("de-CH", { month: "short" })} – ${lastDay.getDate()}. ${lastDay.toLocaleDateString("de-CH", { month: "short", year: "numeric" })}`

  const expenses = transactions.filter(t => t.category.type === "expense")
  const total = expenses.reduce((s, t) => s + t.amount, 0)

  const byUser: Record<string, { name: string; color: string; total: number }> = {}
  for (const t of expenses) {
    if (!byUser[t.user.id]) byUser[t.user.id] = { name: t.user.name, color: t.user.color, total: 0 }
    byUser[t.user.id].total += t.amount
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="ink-panel px-6 pt-safe pb-8 rounded-b-[32px]">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-cream/50 hover:text-cream transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          {account && (
            <div className="flex items-center gap-2">
              <span className="text-xl">{account.icon}</span>
              <p className="display text-cream text-lg">{account.name}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-6">
          <button onClick={prevPeriod} className="text-cream/50 hover:text-cream transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="kicker text-cream/45">{periodLabel}</p>
          <button onClick={nextPeriod} className="text-cream/50 hover:text-cream transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <p className="amount text-cream text-[44px] leading-none">−{formatCHF(total)}</p>
        <p className="kicker text-cream/35 mt-2">Ausgaben</p>

        {Object.keys(byUser).length > 1 && (
          <div className="flex gap-4 mt-6">
            {Object.values(byUser).map(u => (
              <div key={u.name}>
                <p className="kicker text-cream/40 mb-1">{u.name}</p>
                <p className="amount text-[15px]" style={{ color: u.color }}>−{formatCHF(u.total)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <SkeletonList count={6} />
        ) : transactions.length === 0 ? (
          <p className="text-muted text-sm text-center py-12">Keine Buchungen in dieser Periode</p>
        ) : (
          <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
            {transactions.map((t, i) => (
              <div key={t.id} className={`flex items-center gap-4 px-5 py-4 ${i < transactions.length - 1 ? "border-b border-rule/60" : ""}`}>
                <span className="text-2xl w-8 text-center">{t.category.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{t.description || t.category.name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {formatDate(t.date)}
                    <span className="mx-1">·</span>
                    <span style={{ color: t.user.color }} className="font-semibold">{t.user.name}</span>
                  </p>
                </div>
                <p className={`amount text-[15px] ${t.category.type === "income" ? "text-pine" : "text-ink"}`}>
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
