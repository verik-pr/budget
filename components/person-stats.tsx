"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CONTRIBUTORS, expenseShares, formatCHF, type PersonMode } from "@/lib/utils"
import { Skeleton, SkeletonList } from "@/components/skeleton"
import { useToast } from "@/components/toast"

type Tx = {
  amount: number
  date: string
  contributor: string | null
  sharedWith: string | null
  sharedRatio: number | null
  user: { name: string }
  category: { id: string; name: string; icon: string; type: string }
}

type RangeOption = { months: number; label: string }

const RANGES: RangeOption[] = [
  { months: 1, label: "1 Mt" },
  { months: 3, label: "3 Mt" },
  { months: 6, label: "6 Mt" },
  { months: 12, label: "1 Jahr" },
  { months: 0, label: "Alles" },
]

function currentPeriodStart() {
  const today = new Date()
  return today.getDate() >= 24
    ? new Date(today.getFullYear(), today.getMonth(), 24)
    : new Date(today.getFullYear(), today.getMonth() - 1, 24)
}

// Periode 24.–23.; benannt nach dem Monat, in dem sie endet
function periodLabel(start: Date) {
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 24)
  return end.toLocaleDateString("de-CH", { month: "short" })
}

function periodKey(d: Date) {
  const shifted = d.getDate() >= 24 ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : d
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`
}

type Person = { value: string; label: string; color: string }

export function PersonStats() {
  const toast = useToast()
  const [months, setMonths] = useState(3)
  const [mode, setMode] = useState<PersonMode>("effektiv")
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const fetchSeq = useRef(0)

  const fetchRange = useCallback(async () => {
    setLoading(true)
    const seq = ++fetchSeq.current
    const curStart = currentPeriodStart()
    const end = new Date(curStart.getFullYear(), curStart.getMonth() + 1, 24)
    const start = months === 0
      ? new Date(2000, 0, 1)
      : new Date(curStart.getFullYear(), curStart.getMonth() - (months - 1), 24)
    const params = new URLSearchParams({ startDate: start.toISOString(), endDate: end.toISOString() })
    try {
      const res = await fetch(`/api/transactions?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      // Veraltete Antwort verwerfen (schneller Zeitraum-Wechsel)
      if (seq !== fetchSeq.current) return
      setTransactions(data)
    } catch {
      if (seq === fetchSeq.current) toast("Konnte Personen-Statistik nicht laden", "error")
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [months, toast])

  useEffect(() => { fetchRange() }, [fetchRange])

  const expenses = useMemo(() => transactions.filter(t => t.category.type === "expense"), [transactions])

  const { persons, totals, grandTotal, byPeriod, byCategory } = useMemo(() => {
    const totals = new Map<string, number>()
    const byPeriod = new Map<string, Map<string, number>>()
    const byCategory = new Map<string, { name: string; icon: string; perPerson: Map<string, number>; total: number }>()

    for (const t of expenses) {
      const pKey = periodKey(new Date(t.date))
      for (const [person, amount] of expenseShares(t, mode)) {
        totals.set(person, (totals.get(person) ?? 0) + amount)
        if (!byPeriod.has(pKey)) byPeriod.set(pKey, new Map())
        const pm = byPeriod.get(pKey)!
        pm.set(person, (pm.get(person) ?? 0) + amount)
        if (!byCategory.has(t.category.id)) {
          byCategory.set(t.category.id, { name: t.category.name, icon: t.category.icon, perPerson: new Map(), total: 0 })
        }
        const cat = byCategory.get(t.category.id)!
        cat.perPerson.set(person, (cat.perPerson.get(person) ?? 0) + amount)
        cat.total += amount
      }
    }

    const persons: Person[] = CONTRIBUTORS
      .filter(c => (totals.get(c.value) ?? 0) > 0.005)
      .map(c => ({ value: c.value, label: c.label.split(" ")[0], color: c.color }))
    const grandTotal = [...totals.values()].reduce((s, v) => s + v, 0)
    return { persons, totals, grandTotal, byPeriod, byCategory }
  }, [expenses, mode])

  // Lückenlos von der ersten bis zur letzten Periode — Monate ohne Buchungen
  // erscheinen als Null-Balken statt zu fehlen
  const sortedPeriods = useMemo(() => {
    const keys = [...byPeriod.keys()].sort()
    if (keys.length < 2) return keys
    const out: string[] = []
    let [y, m] = keys[0].split("-").map(Number)
    const last = keys[keys.length - 1]
    while (out.length < 400) {
      const k = `${y}-${String(m).padStart(2, "0")}`
      out.push(k)
      if (k === last) break
      m++
      if (m > 12) { m = 1; y++ }
    }
    return out
  }, [byPeriod])
  const maxPeriodValue = useMemo(() => {
    let max = 0
    for (const pm of byPeriod.values()) for (const v of pm.values()) max = Math.max(max, v)
    return max
  }, [byPeriod])

  const sortedCategories = useMemo(
    () => [...byCategory.values()].sort((a, b) => b.total - a.total),
    [byCategory]
  )

  const showTrend = sortedPeriods.length > 1
  const spansYears = sortedPeriods.length > 1 &&
    sortedPeriods[0].slice(0, 4) !== sortedPeriods[sortedPeriods.length - 1].slice(0, 4)
  const trendLabelFor = (key: string) => {
    const [y, m] = key.split("-").map(Number)
    const base = periodLabel(new Date(y, m - 2, 24))
    return spansYears ? `${base} ${String(y).slice(2)}` : base
  }

  return (
    <div className="space-y-6">

      {/* Zeitraum + Zählweise */}
      <div className="space-y-2.5">
        <div className="flex gap-2 flex-wrap">
          {RANGES.map(r => (
            <button key={r.months} onClick={() => setMonths(r.months)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-[0.97] ${months === r.months ? "bg-ink text-cream" : "bg-card border border-rule text-muted"}`}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex bg-card border border-rule rounded-full p-0.5">
            {(["effektiv", "bezahlt"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${mode === m ? "bg-ink text-cream" : "text-muted"}`}>
                {m === "effektiv" ? "Effektiv" : "Bezahlt"}
              </button>
            ))}
          </div>
          <p className="text-xs text-faint">
            {mode === "effektiv" ? "Splits anteilig verteilt" : "wer bezahlt hat"}
          </p>
        </div>
      </div>

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-28 rounded-3xl" />
            <Skeleton className="h-28 rounded-3xl" />
          </div>
          <SkeletonList count={4} />
        </>
      ) : persons.length === 0 ? (
        <p className="text-muted text-sm text-center py-12">Keine Ausgaben im gewählten Zeitraum</p>
      ) : (
        <>
          {/* Personen-Karten */}
          <div className={`grid gap-3 ${persons.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {persons.map(p => {
              const total = totals.get(p.value) ?? 0
              const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0
              return (
                <div key={p.value} className="bg-card border border-rule shadow-card rounded-3xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-cream text-xs font-black flex-shrink-0"
                      style={{ backgroundColor: p.color }}>{p.label[0]}</div>
                    <p className="text-sm font-semibold text-ink truncate">{p.label}</p>
                  </div>
                  <p className="amount text-[22px] text-ink leading-none">{formatCHF(total)}</p>
                  <p className="text-xs text-muted mt-1.5">{pct.toFixed(0)}% aller Ausgaben</p>
                  <div className="h-1.5 bg-rule/60 rounded-full overflow-hidden mt-2">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Monatsverlauf */}
          {showTrend && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="kicker text-muted">Verlauf pro Periode</p>
                <div className="flex items-center gap-3">
                  {persons.map(p => (
                    <div key={p.value} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-xs text-muted font-semibold">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-card border border-rule shadow-card rounded-3xl px-4 pt-5 pb-3 overflow-x-auto">
                <div className="flex items-end gap-3 min-h-[120px]" style={{ minWidth: sortedPeriods.length > 6 ? sortedPeriods.length * 52 : undefined }}>
                  {sortedPeriods.map(key => {
                    const pm = byPeriod.get(key) ?? new Map<string, number>()
                    return (
                      <div key={key} className="flex-1 flex flex-col items-center gap-1.5 min-w-[44px]">
                        <div className="flex items-end gap-[2px] h-[110px] w-full justify-center">
                          {persons.map(p => {
                            const v = pm.get(p.value) ?? 0
                            const h = maxPeriodValue > 0 ? Math.max(v > 0 ? 3 : 0, (v / maxPeriodValue) * 110) : 0
                            return (
                              <div key={p.value} className="w-[14px] rounded-t-[4px] transition-all"
                                title={`${p.label}: ${formatCHF(v)}`}
                                style={{ height: `${h}px`, backgroundColor: p.color }} />
                            )
                          })}
                        </div>
                        <p className="text-[10px] text-faint font-semibold uppercase tracking-wide whitespace-nowrap">{trendLabelFor(key)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
              <p className="text-[10px] text-faint mt-1.5 text-right">Perioden jeweils 24.–23.</p>
            </div>
          )}

          {/* Kategorien-Split */}
          <div>
            <div className="flex items-baseline gap-2 mb-3">
              <p className="amount text-[34px] text-ink">{formatCHF(grandTotal)}</p>
              <p className="kicker text-muted">Total</p>
            </div>
            <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
              {sortedCategories.map((cat, i) => {
                const catPct = grandTotal > 0 ? (cat.total / grandTotal) * 100 : 0
                return (
                  <div key={cat.name} className={`px-5 py-4 ${i < sortedCategories.length - 1 ? "border-b border-rule/60" : ""}`}>
                    <div className="flex items-center gap-3 mb-2.5">
                      <span className="text-xl w-7 text-center">{cat.icon}</span>
                      <p className="text-sm font-semibold text-ink flex-1">{cat.name}</p>
                      <div className="text-right">
                        <p className="amount text-[15px] text-ink">{formatCHF(cat.total)}</p>
                        <p className="text-xs text-muted">{catPct.toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="flex h-1.5 rounded-full overflow-hidden gap-[2px]">
                      {persons.map(p => {
                        const v = cat.perPerson.get(p.value) ?? 0
                        const w = cat.total > 0 ? (v / cat.total) * 100 : 0
                        if (w < 0.5) return null
                        return <div key={p.value} className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: p.color }} />
                      })}
                    </div>
                    <div className="flex gap-4 mt-1.5">
                      {persons.map(p => {
                        const v = cat.perPerson.get(p.value) ?? 0
                        if (v < 0.005) return null
                        return (
                          <div key={p.value} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                            <p className="text-xs text-muted tabular-nums">{p.label} {formatCHF(v)}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
