"use client"

import { formatCHF } from "@/lib/utils"
import { ChevronDown, ChevronUp } from "lucide-react"

type Tx = {
  amount: number
  category: { id: string; name: string; icon: string; type: string }
}

type CatDelta = { id: string; name: string; icon: string; current: number; previous: number; delta: number }

// «Warum dieser Monat?» — Kategorien-Deltas zur Vorperiode,
// sortiert nach absolutem Unterschied
export function DeltaCard({
  current,
  previous,
  open,
  onToggle,
}: {
  current: Tx[]
  previous: Tx[]
  open: boolean
  onToggle: () => void
}) {
  const cats = new Map<string, CatDelta>()
  for (const t of current) {
    if (t.category.type !== "expense") continue
    const e = cats.get(t.category.id) ?? { id: t.category.id, name: t.category.name, icon: t.category.icon, current: 0, previous: 0, delta: 0 }
    e.current += t.amount
    cats.set(t.category.id, e)
  }
  for (const t of previous) {
    if (t.category.type !== "expense") continue
    const e = cats.get(t.category.id) ?? { id: t.category.id, name: t.category.name, icon: t.category.icon, current: 0, previous: 0, delta: 0 }
    e.previous += t.amount
    cats.set(t.category.id, e)
  }

  // Totale über ALLE Kategorien — auch die mit identischem Betrag (Miete,
  // Recurring), sonst ist die Prozent-Basis zu klein und widerspricht
  // der Dashboard-Kachel «+X% vs. Vormonat»
  const allCats = [...cats.values()].map(c => ({ ...c, delta: c.current - c.previous }))
  const totalDelta = allCats.reduce((s, c) => s + c.delta, 0)
  const prevTotal = allCats.reduce((s, c) => s + c.previous, 0)
  const pct = prevTotal > 0 ? Math.round((totalDelta / prevTotal) * 100) : null

  const deltas = allCats
    .filter(c => Math.abs(c.delta) >= 0.005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const main = deltas.filter(c => Math.abs(c.delta) >= 5)
  const rest = deltas.filter(c => Math.abs(c.delta) < 5)
  const restDelta = rest.reduce((s, c) => s + c.delta, 0)

  if (prevTotal === 0 && deltas.length === 0) return null

  return (
    <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
      <button onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 active:bg-paper/60 transition-colors text-left">
        <div className="flex-1">
          <p className="kicker text-muted">Warum dieser Monat?</p>
          <p className="text-sm mt-1">
            <span className={`font-bold tabular-nums ${totalDelta <= 0 ? "text-pine" : "text-blood"}`}>
              {totalDelta >= 0 ? "+" : "−"}{formatCHF(Math.abs(totalDelta))}
            </span>
            <span className="text-muted"> vs. Vorperiode{pct !== null ? ` (${pct >= 0 ? "+" : ""}${pct}%)` : ""}</span>
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-faint" /> : <ChevronDown className="w-4 h-4 text-faint" />}
      </button>

      {open && (
        <div className="border-t border-rule/60">
          {prevTotal === 0 ? (
            <p className="text-muted text-xs px-5 py-4">Keine Buchungen in der Vorperiode — kein Vergleich möglich.</p>
          ) : (
            <>
              {main.map((c, i) => (
                <div key={c.id} className={`flex items-center gap-3 px-5 py-3 ${i < main.length - 1 || rest.length > 0 ? "border-b border-rule/40" : ""}`}>
                  <span className="text-base w-6 text-center flex-shrink-0">{c.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{c.name}</p>
                    <p className="text-xs text-muted tabular-nums">{formatCHF(c.previous)} → {formatCHF(c.current)}</p>
                  </div>
                  <p className={`amount text-[14px] tabular-nums flex-shrink-0 ${c.delta <= 0 ? "text-pine" : "text-blood"}`}>
                    {c.delta >= 0 ? "+" : "−"}{formatCHF(Math.abs(c.delta))}
                  </p>
                </div>
              ))}
              {rest.length > 0 && Math.abs(restDelta) >= 0.005 && (
                <div className="flex items-center gap-3 px-5 py-3">
                  <span className="text-base w-6 text-center flex-shrink-0">·</span>
                  <p className="text-sm text-muted flex-1">Übrige ({rest.length} Kategorien)</p>
                  <p className={`amount text-[14px] tabular-nums ${restDelta <= 0 ? "text-pine" : "text-blood"}`}>
                    {restDelta >= 0 ? "+" : "−"}{formatCHF(Math.abs(restDelta))}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
