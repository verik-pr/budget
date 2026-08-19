"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Pencil } from "lucide-react"
import { formatCHF, formatDate } from "@/lib/utils"
import { Skeleton, SkeletonList } from "@/components/skeleton"
import { useToast } from "@/components/toast"

type Tx = {
  id: string
  date: string
  amount: number
  description: string | null
  receiptId: string | null
  receiptMerchant: string | null
  isPrivate?: boolean
  category: { id: string; name: string; icon: string; type: string; budget: number | null }
}

const PERIODS = 6

function currentPeriodStart() {
  const today = new Date()
  return today.getDate() >= 24
    ? new Date(today.getFullYear(), today.getMonth(), 24)
    : new Date(today.getFullYear(), today.getMonth() - 1, 24)
}

// Periode 24.–23., benannt nach dem Monat, in dem sie endet
function periodKeyOf(d: Date) {
  const shifted = d.getDate() >= 24 ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : d
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`
}

function periodLabelOf(key: string) {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("de-CH", { month: "short" })
}

export default function KategorieDrilldownPage() {
  const router = useRouter()
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const categoryId = decodeURIComponent(id)

  const [transactions, setTransactions] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const cur = currentPeriodStart()
    return periodKeyOf(new Date(cur.getFullYear(), cur.getMonth(), 24))
  })

  useEffect(() => {
    const cur = currentPeriodStart()
    const start = new Date(cur.getFullYear(), cur.getMonth() - (PERIODS - 1), 24)
    const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 24)
    const params = new URLSearchParams({ startDate: start.toISOString(), endDate: end.toISOString() })
    fetch(`/api/transactions?${params}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((data: Tx[]) => {
        setTransactions(data.filter(t => t.category.id === categoryId))
        setLoading(false)
      })
      .catch(() => { toast("Konnte Daten nicht laden", "error"); setLoading(false) })
  }, [categoryId, toast])

  const category = transactions[0]?.category ?? null

  // Perioden-Historie (alle 6, lückenlos)
  const { periodKeys, byPeriod } = useMemo(() => {
    const cur = currentPeriodStart()
    const keys: string[] = []
    for (let i = PERIODS - 1; i >= 0; i--) {
      keys.push(periodKeyOf(new Date(cur.getFullYear(), cur.getMonth() - i, 24)))
    }
    const map = new Map<string, number>()
    for (const t of transactions) {
      const k = periodKeyOf(new Date(t.date))
      map.set(k, (map.get(k) ?? 0) + t.amount)
    }
    return { periodKeys: keys, byPeriod: map }
  }, [transactions])

  const maxPeriod = Math.max(1, ...periodKeys.map(k => byPeriod.get(k) ?? 0))

  // Auswertung der gewählten Periode
  const periodTxs = useMemo(
    () => transactions.filter(t => periodKeyOf(new Date(t.date)) === selectedPeriod),
    [transactions, selectedPeriod]
  )
  const periodTotal = periodTxs.reduce((s, t) => s + t.amount, 0)

  // Wofür: nach Händler/Beschreibung gruppiert; Einkäufe via receiptId dedupliziert
  const breakdown = useMemo(() => {
    const groups = new Map<string, { label: string; total: number; purchases: Set<string> }>()
    for (const t of periodTxs) {
      const label = t.receiptMerchant?.trim()
        || t.description?.trim()
        || (t.isPrivate ? "🔒 Privat" : "Ohne Beschreibung")
      const key = label.toLowerCase()
      const g = groups.get(key) ?? { label, total: 0, purchases: new Set<string>() }
      g.total += t.amount
      g.purchases.add(t.receiptId ?? t.id)
      groups.set(key, g)
    }
    return [...groups.values()].sort((a, b) => b.total - a.total).slice(0, 10)
  }, [periodTxs])
  const maxGroup = Math.max(1, ...breakdown.map(g => g.total))

  const topTxs = useMemo(
    () => [...periodTxs].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [periodTxs]
  )

  const budget = category?.budget ?? null
  const budgetPct = budget && budget > 0 ? (periodTotal / budget) * 100 : null

  return (
    <div className="max-w-lg mx-auto">
      <div className="ink-panel px-6 pt-safe pb-6 rounded-b-[28px]">
        <div className="flex items-center gap-3 mb-4">
          <button type="button" onClick={() => router.back()} className="text-cream/50 hover:text-cream transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="kicker text-cream/45">Kategorie</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{category?.icon ?? "📊"}</span>
          <div className="flex-1">
            <p className="display text-cream text-2xl">{category?.name ?? categoryId}</p>
            <p className="text-cream/45 text-xs mt-0.5">Periode {periodLabelOf(selectedPeriod)} (24.–23.)</p>
          </div>
        </div>
        <p className="amount text-cream text-[38px] mt-4">{formatCHF(periodTotal)}</p>
        {budgetPct !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <p className="text-cream/45">Budget {formatCHF(budget!)}</p>
              <p className={`font-semibold ${budgetPct > 100 ? "text-[#e89890]" : "text-cream/60"}`}>{budgetPct.toFixed(0)}%</p>
            </div>
            <div className="h-1.5 bg-cream/10 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${budgetPct > 100 ? "bg-[#e89890]" : "bg-[#7fc89e]"}`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="stagger px-6 pt-6 pb-8 space-y-6">
        {loading ? (
          <>
            <Skeleton className="h-36 w-full rounded-3xl" />
            <SkeletonList count={4} />
          </>
        ) : transactions.length === 0 ? (
          <p className="text-muted text-sm text-center py-12">Keine Buchungen in den letzten {PERIODS} Perioden</p>
        ) : (
          <>
            {/* Perioden-Verlauf — Balken antippen wechselt die Auswertung */}
            <div>
              <p className="kicker text-muted mb-3">Verlauf — Balken antippen</p>
              <div className="bg-card border border-rule shadow-card rounded-3xl px-4 pt-5 pb-3">
                <div className="flex items-end gap-2 h-[110px]">
                  {periodKeys.map(key => {
                    const v = byPeriod.get(key) ?? 0
                    const h = Math.max(v > 0 ? 4 : 2, (v / maxPeriod) * 96)
                    const active = key === selectedPeriod
                    return (
                      <button key={key} type="button" onClick={() => setSelectedPeriod(key)}
                        className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                        <p className={`text-[10px] tabular-nums ${active ? "text-ink font-bold" : "text-faint"}`}>
                          {v > 0 ? Math.round(v) : ""}
                        </p>
                        <div className={`w-full max-w-[34px] rounded-t-[4px] transition-all ${active ? "bg-ink" : "bg-rule"}`}
                          style={{ height: `${h}px` }} />
                        <p className={`text-[10px] uppercase tracking-wide ${active ? "text-ink font-bold" : "text-faint"}`}>
                          {periodLabelOf(key)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Wofür genau */}
            <div>
              <p className="kicker text-muted mb-3">Wofür — {periodLabelOf(selectedPeriod)}</p>
              {breakdown.length === 0 ? (
                <p className="text-muted text-sm text-center py-8">Keine Buchungen in dieser Periode</p>
              ) : (
                <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
                  {breakdown.map((g, i) => (
                    <div key={g.label} className={`px-5 py-3.5 ${i < breakdown.length - 1 ? "border-b border-rule/60" : ""}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-sm font-semibold text-ink flex-1 truncate">{g.label}</p>
                        <div className="text-right flex-shrink-0">
                          <p className="amount text-[14px] text-ink">{formatCHF(g.total)}</p>
                          <p className="text-[10px] text-muted">{g.purchases.size}× </p>
                        </div>
                      </div>
                      <div className="h-1 bg-rule/60 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-ink" style={{ width: `${(g.total / maxGroup) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grösste Buchungen */}
            {topTxs.length > 0 && (
              <div>
                <p className="kicker text-muted mb-3">Grösste Buchungen — {periodLabelOf(selectedPeriod)}</p>
                <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
                  {topTxs.map((t, i) => (
                    <div key={t.id} className={`flex items-center gap-3 px-5 py-3.5 ${i < topTxs.length - 1 ? "border-b border-rule/60" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">
                          {t.isPrivate && !t.description ? "🔒 Privat" : (t.receiptMerchant || t.description || category?.name)}
                        </p>
                        <p className="text-xs text-muted mt-0.5">{formatDate(t.date)}</p>
                      </div>
                      <p className="amount text-[15px] text-ink flex-shrink-0">{formatCHF(t.amount)}</p>
                      {!(t.isPrivate && !t.description) && (
                        <Link href={`/transactions/${t.id}/edit`} className="text-faint hover:text-pine p-1">
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
