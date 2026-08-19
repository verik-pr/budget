"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { creditCardBalanceOf, formatCHF, parseAmount } from "@/lib/utils"
import { DeltaCard } from "@/components/delta-card"
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, X, Check } from "lucide-react"
import { CONTRIBUTORS } from "@/lib/utils"
import { useConfirm } from "@/components/confirm-sheet"
import { Skeleton, SkeletonList } from "@/components/skeleton"
import { useToast } from "@/components/toast"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { PersonStats } from "@/components/person-stats"

type Transaction = {
  amount: number
  contributor: string | null
  sharedWith: string | null
  sharedRatio: number | null
  user: { name: string }
  category: { id: string; name: string; icon: string; type: string; budget: number | null }
}
type Account = { id: string; name: string; icon: string; color: string; type: string; dueDay: number | null; ownerName: string | null }
type CategoryStat = { id: string; name: string; icon: string; total: number; budget: number | null }
type PersonStat = { label: string; color: string; total: number }
type Provision = { id: string; name: string; icon: string; totalAmount: number; frequencyMonths: number; nextDueDate: string }
type DebtTx = {
  id: string
  amount: number
  contributor: string | null
  sharedWith: string | null
  sharedRatio: number | null
  category: { id: string; name: string; icon: string }
}
type DebtData = {
  net: number
  partnerOwesMe: number
  iOwePartner: number
  partnerLabel: string
  partnerColor: string
  myLabel: string
  transactions: DebtTx[]
}

function initialPeriodStart() {
  const today = new Date()
  return today.getDate() >= 24
    ? new Date(today.getFullYear(), today.getMonth(), 24)
    : new Date(today.getFullYear(), today.getMonth() - 1, 24)
}

const FREQ_OPTIONS = [
  { value: 1, label: "Monatlich" },
  { value: 3, label: "Quartalsweise" },
  { value: 6, label: "Halbjährlich" },
  { value: 12, label: "Jährlich" },
]

function monthlyAmount(p: Provision) { return p.totalAmount / p.frequencyMonths }

function monthsUntil(dateStr: string) {
  const due = new Date(dateStr)
  const now = new Date()
  return Math.max(0, Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)))
}

function ProvisionForm({ initial, onSave, onCancel }: {
  initial?: Partial<Provision>
  onSave: (data: Omit<Provision, "id">) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [icon, setIcon] = useState(initial?.icon ?? "📅")
  const [totalAmount, setTotalAmount] = useState(initial?.totalAmount?.toString() ?? "")
  const [frequencyMonths, setFrequencyMonths] = useState(initial?.frequencyMonths ?? 12)
  const [nextDueDate, setNextDueDate] = useState(initial?.nextDueDate ?? "")

  return (
    <div className="bg-card border border-rule shadow-card rounded-2xl p-4 space-y-3">
      <div className="flex gap-2">
        <input value={icon} onChange={e => setIcon(e.target.value)}
          className="w-14 bg-paper border border-rule rounded-xl px-3 py-2 text-xl text-center focus:outline-none focus:border-pine/50" />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (z.B. ÖV-Abo)"
          className="flex-1 bg-paper border border-rule rounded-xl px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-pine/50" />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-muted text-xs mb-1">Betrag CHF</p>
          <input type="text" inputMode="decimal" value={totalAmount} onChange={e => setTotalAmount(e.target.value)}
            placeholder="1200.00"
            className="w-full bg-paper border border-rule rounded-xl px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-pine/50" />
        </div>
        <div className="flex-1">
          <p className="text-muted text-xs mb-1">Frequenz</p>
          <select value={frequencyMonths} onChange={e => setFrequencyMonths(parseInt(e.target.value))}
            className="w-full bg-paper border border-rule rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-pine/50">
            {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p className="text-muted text-xs mb-1">Nächste Fälligkeit</p>
        <input type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)}
          className="w-full bg-paper border border-rule rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-pine/50" />
      </div>
      {parseAmount(totalAmount) !== null && (
        <p className="text-muted text-xs italic font-serif">
          = CHF {((parseAmount(totalAmount) as number) / frequencyMonths).toFixed(2)}/Monat beiseitelegen
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-paper border border-rule text-muted rounded-xl py-2 text-sm font-bold">Abbrechen</button>
        <button
          onClick={() => { const parsed = parseAmount(totalAmount); if (name && parsed && nextDueDate) onSave({ name, icon, totalAmount: parsed, frequencyMonths, nextDueDate }) }}
          disabled={!name || !parseAmount(totalAmount) || !nextDueDate}
          className="flex-1 bg-pine text-cream rounded-xl py-2 text-sm font-bold disabled:opacity-30">
          Speichern
        </button>
      </div>
    </div>
  )
}

export default function StatsPage() {
  const confirm = useConfirm()
  const toast = useToast()
  const [periodStart, setPeriodStart] = useState<Date>(initialPeriodStart)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [prevTransactions, setPrevTransactions] = useState<Transaction[]>([])
  const [tab, setTab] = useState<"expense" | "income" | "personen" | "planung" | "gemeinsam">("expense")
  const [deltaOpen, setDeltaOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const fetchSeq = useRef(0)

  // ?tab=personen etc. als Start-Tab (z.B. vom Dashboard-Modul verlinkt),
  // ?delta=1 öffnet die Delta-Karte direkt
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wanted = params.get("tab")
    if (wanted === "personen" || wanted === "income" || wanted === "planung" || wanted === "gemeinsam") setTab(wanted)
    if (params.get("delta") === "1") setDeltaOpen(true)
  }, [])

  // Gemeinsame Auslagen (kumulierte Abrechnung)
  const [debtData, setDebtData] = useState<DebtData | null>(null)
  const [debtLoading, setDebtLoading] = useState(false)

  // Credit cards
  const [creditAccounts, setCreditAccounts] = useState<(Account & { balance: number })[]>([])

  // Provisions
  const [provisions, setProvisions] = useState<Provision[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/accounts?mine=true")
      .then(r => r.json())
      .then(({ accounts: accs, defaultId }: { accounts: Account[]; defaultId: string | null }) => {
        setAccounts(accs.filter(a => a.type !== "credit"))
        setAccountId(defaultId)
        const credits = accs.filter(a => a.type === "credit")
        // Fetch balances for credit cards
        Promise.all(credits.map(async acc => {
          const now = new Date()
          const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          const params = new URLSearchParams({ startDate: start.toISOString(), endDate: end.toISOString(), accountId: acc.id })
          const txs = await fetch(`/api/transactions?${params}`).then(r => r.json())
          // Zahlungen (Einnahmen-Buchungen) reduzieren den offenen Saldo
          return { ...acc, balance: creditCardBalanceOf(txs) }
        })).then(setCreditAccounts)
      })
  }, [])

  const fetchTransactions = useCallback(async (showLoader: boolean) => {
    if (showLoader) setLoading(true)
    const seq = ++fetchSeq.current
    const end = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 24)
    const prevStart = new Date(periodStart.getFullYear(), periodStart.getMonth() - 1, 24)
    const mkParams = (s: Date, e: Date) => new URLSearchParams({
      startDate: s.toISOString(),
      endDate: e.toISOString(),
      ...(accountId ? { accountId } : {}),
    })
    try {
      const [res, prevRes] = await Promise.all([
        fetch(`/api/transactions?${mkParams(periodStart, end)}`),
        fetch(`/api/transactions?${mkParams(prevStart, periodStart)}`),
      ])
      if (!res.ok || !prevRes.ok) throw new Error()
      const [cur, prev] = await Promise.all([res.json(), prevRes.json()])
      // Veraltete Antworten verwerfen (schnelles Perioden-Blättern)
      if (seq !== fetchSeq.current) return
      setTransactions(cur)
      setPrevTransactions(prev)
    } catch {
      if (seq === fetchSeq.current) toast("Konnte Statistik nicht laden", "error")
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [periodStart, accountId, toast])

  useEffect(() => { fetchTransactions(true) }, [fetchTransactions])

  const fetchProvisions = useCallback(async () => {
    try {
      const res = await fetch("/api/provisions")
      if (!res.ok) throw new Error()
      setProvisions(await res.json())
    } catch {
      toast("Konnte Rückstellungen nicht laden", "error")
    }
  }, [toast])

  const fetchDebts = useCallback(async () => {
    setDebtLoading(true)
    try {
      const res = await fetch("/api/debts")
      if (!res.ok) throw new Error()
      setDebtData(await res.json())
    } catch {
      toast("Konnte Abrechnung nicht laden", "error")
    } finally {
      setDebtLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (tab === "planung") fetchProvisions()
    if (tab === "gemeinsam") fetchDebts()
  }, [tab, fetchProvisions, fetchDebts])

  async function refresh() {
    await Promise.all([
      tab === "gemeinsam" ? Promise.resolve() : fetchTransactions(false),
      tab === "planung" ? fetchProvisions() : Promise.resolve(),
      tab === "gemeinsam" ? fetchDebts() : Promise.resolve(),
    ])
  }

  async function createProvision(data: Omit<Provision, "id">) {
    try {
      const res = await fetch("/api/provisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error()
      const p = await res.json()
      setProvisions(prev => [...prev, p])
      setShowForm(false)
      toast("Rückstellung angelegt")
    } catch {
      toast("Konnte nicht speichern", "error")
    }
  }

  async function updateProvision(id: string, data: Omit<Provision, "id">) {
    try {
      const res = await fetch(`/api/provisions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error()
      const p = await res.json()
      setProvisions(prev => prev.map(x => x.id === id ? p : x))
      setEditingId(null)
      toast("Rückstellung aktualisiert")
    } catch {
      toast("Konnte nicht speichern", "error")
    }
  }

  async function deleteProvision(id: string) {
    const ok = await confirm({ title: "Rückstellung löschen?", confirmLabel: "Löschen", destructive: true })
    if (!ok) return
    const backup = provisions
    setProvisions(prev => prev.filter(x => x.id !== id))
    try {
      const res = await fetch(`/api/provisions/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast("Rückstellung gelöscht")
    } catch {
      setProvisions(backup)
      toast("Konnte nicht gelöscht werden", "error")
    }
  }

  function prevPeriod() { setPeriodStart(p => new Date(p.getFullYear(), p.getMonth() - 1, 24)) }
  function nextPeriod() { setPeriodStart(p => new Date(p.getFullYear(), p.getMonth() + 1, 24)) }

  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 24)
  const lastDay = new Date(periodEnd.getTime() - 86400000)
  const periodLabel = `${periodStart.getDate()}. ${periodStart.toLocaleDateString("de-CH", { month: "short" })} – ${lastDay.getDate()}. ${lastDay.toLocaleDateString("de-CH", { month: "short", year: "numeric" })}`

  const filtered = transactions.filter(t => t.category.type === tab)
  const total = filtered.reduce((s, t) => s + t.amount, 0)

  const byCategory: CategoryStat[] = Object.values(
    filtered.reduce((acc, t) => {
      const key = t.category.id
      if (!acc[key]) acc[key] = { id: t.category.id, name: t.category.name, icon: t.category.icon, total: 0, budget: t.category.budget }
      acc[key].total += t.amount
      return acc
    }, {} as Record<string, CategoryStat>)
  ).sort((a, b) => b.total - a.total)

  // ── Gemeinsame Auslagen: kumuliert aus allen Split-Buchungen ──
  const debtTxs = debtData?.transactions ?? []
  const byPerson: PersonStat[] = Object.values(
    debtTxs.reduce((acc, t) => {
      const payer = t.contributor
      if (!payer) return acc
      if (!acc[payer]) {
        const c = CONTRIBUTORS.find(x => x.value === payer)
        acc[payer] = { label: c ? c.label.split(" ")[0] : payer, color: c?.color ?? "#6366f1", total: 0 }
      }
      acc[payer].total += t.amount
      return acc
    }, {} as Record<string, PersonStat>)
  ).sort((a, b) => b.total - a.total)
  const personTotal = byPerson.reduce((s, p) => s + p.total, 0)
  const bySharedCategory: CategoryStat[] = Object.values(
    debtTxs.reduce((acc, t) => {
      const key = t.category.id
      if (!acc[key]) acc[key] = { id: t.category.id, name: t.category.name, icon: t.category.icon, total: 0, budget: null }
      acc[key].total += t.amount
      return acc
    }, {} as Record<string, CategoryStat>)
  ).sort((a, b) => b.total - a.total)
  const sharedCatTotal = bySharedCategory.reduce((s, c) => s + c.total, 0)

  const totalMonthly = provisions.reduce((s, p) => s + monthlyAmount(p), 0)
  const nextDueDate = (acc: Account & { balance: number }) => {
    const now = new Date()
    const day = acc.dueDay ?? 15
    let due = new Date(now.getFullYear(), now.getMonth(), day)
    if (due <= now) due = new Date(now.getFullYear(), now.getMonth() + 1, day)
    return due.toLocaleDateString("de-CH", { day: "numeric", month: "short" })
  }

  return (
    <PullToRefresh onRefresh={refresh}>
    <div className="max-w-lg mx-auto">
      <div className="ink-panel px-6 pt-safe pb-4 sticky top-0 z-10 rounded-b-[28px]">
        {(tab === "expense" || tab === "income") && (
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevPeriod} className="text-cream/50 hover:text-cream transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <p className="display text-cream text-[15px]">{periodLabel}</p>
            <button onClick={nextPeriod} className="text-cream/50 hover:text-cream transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
        {(tab === "expense" || tab === "income") && accounts.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {accounts.map(acc => (
              <button key={acc.id} type="button"
                onClick={() => setAccountId(acc.id)}
                style={accountId === acc.id ? { backgroundColor: acc.color } : {}}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-[0.97] ${accountId === acc.id ? "text-cream shadow-md" : "bg-cream/10 text-cream/55 border border-cream/15"}`}>
                <span>{acc.icon}</span><span>{acc.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {(["expense", "income", "personen", "planung", "gemeinsam"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all active:scale-[0.97] ${tab === t ? "bg-cream text-ink" : "bg-cream/10 text-cream/55 border border-cream/15"}`}>
              {t === "expense" ? "Ausgaben" : t === "income" ? "Einnahmen" : t === "personen" ? "Personen" : t === "planung" ? "Planung" : "Gemeinsam"}
            </button>
          ))}
        </div>
      </div>

      <div className="stagger px-6 pt-6 space-y-6 pb-8">

        {/* ── Ausgaben / Einnahmen tabs ── */}
        {(tab === "expense" || tab === "income") && (
          <>
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <p className="amount text-[34px] text-ink">{formatCHF(total)}</p>
                <p className="kicker text-muted">Total</p>
              </div>
              {tab === "expense" && !loading && (
                <div className="mb-4">
                  <DeltaCard current={transactions} previous={prevTransactions}
                    open={deltaOpen} onToggle={() => setDeltaOpen(o => !o)} />
                </div>
              )}
              {loading ? (
                <SkeletonList count={5} />
              ) : byCategory.length === 0 ? (
                <p className="text-muted text-sm text-center py-12">Keine Buchungen</p>
              ) : (
                <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
                  {byCategory.map((cat, i) => {
                    const pct = total > 0 ? (cat.total / total) * 100 : 0
                    const hasBudget = tab === "expense" && cat.budget != null && cat.budget > 0
                    const budgetPct = hasBudget ? (cat.total / (cat.budget as number)) * 100 : 0
                    const over = budgetPct > 100
                    const near = budgetPct > 80 && budgetPct <= 100
                    return (
                      <Link key={cat.id} href={`/stats/kategorie/${encodeURIComponent(cat.id)}`}
                        className={`block px-5 py-4 active:bg-paper/60 transition-colors ${i < byCategory.length - 1 ? "border-b border-rule/60" : ""}`}>
                        <div className="flex items-center gap-3 mb-2.5">
                          <span className="text-xl w-7 text-center">{cat.icon}</span>
                          <p className="text-sm font-semibold text-ink flex-1">{cat.name}</p>
                          <div className="text-right">
                            <p className="amount text-[15px] text-ink">{formatCHF(cat.total)}</p>
                            <p className="text-xs text-muted">{pct.toFixed(0)}%</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-faint flex-shrink-0" />
                        </div>
                        <div className="h-1 bg-rule/60 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${tab === "expense" ? "bg-ink" : "bg-pine"}`} style={{ width: `${pct}%` }} />
                        </div>
                        {hasBudget && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs mb-1">
                              <p className="text-gray-400 tabular-nums">Budget {formatCHF(cat.budget as number)}</p>
                              <p className={`tabular-nums font-semibold ${over ? "text-blood" : near ? "text-[#c47b35]" : "text-muted"}`}>
                                {budgetPct.toFixed(0)}%
                              </p>
                            </div>
                            <div className="h-1 bg-rule/60 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${over ? "bg-blood" : near ? "bg-[#d99a4e]" : "bg-pine"}`}
                                style={{ width: `${Math.min(budgetPct, 100)}%` }} />
                            </div>
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Personen tab ── */}
        {tab === "personen" && <PersonStats />}

        {/* ── Planung tab ── */}
        {tab === "planung" && (
          <>
            {/* Credit cards */}
            {creditAccounts.length > 0 && (
              <div>
                <p className="kicker text-muted mb-3">💳 Kreditkarten</p>
                <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
                  {creditAccounts.map((acc, i) => (
                    <div key={acc.id} className={`flex items-center gap-4 px-5 py-4 ${i < creditAccounts.length - 1 ? "border-b border-rule/60" : ""}`}>
                      <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: acc.color + "20" }}>
                        {acc.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink">{acc.name}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {acc.ownerName && <span>{acc.ownerName} · </span>}
                          fällig {nextDueDate(acc)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="amount text-[15px] text-ink">{formatCHF(acc.balance)}</p>
                        <p className="text-xs text-muted">offen</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Provisions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="kicker text-muted">🗓 Rückstellungen</p>
                <button onClick={() => setShowForm(true)}
                  className="flex items-center gap-1 text-xs font-bold text-pine active:opacity-70">
                  <Plus className="w-3.5 h-3.5" />Neu
                </button>
              </div>

              {showForm && (
                <div className="mb-3">
                  <ProvisionForm onSave={createProvision} onCancel={() => setShowForm(false)} />
                </div>
              )}

              {provisions.length === 0 && !showForm ? (
                <p className="text-muted text-sm text-center py-12">Noch keine Rückstellungen.<br />Tippe auf + Neu um eine hinzuzufügen.</p>
              ) : (
                <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
                  {provisions.map((p, i) => (
                    <div key={p.id}>
                      {editingId === p.id ? (
                        <div className="px-4 py-3">
                          <ProvisionForm
                            initial={p}
                            onSave={data => updateProvision(p.id, data)}
                            onCancel={() => setEditingId(null)} />
                        </div>
                      ) : (
                        <div className={`flex items-center gap-4 px-5 py-4 ${i < provisions.length - 1 ? "border-b border-rule/60" : ""}`}>
                          <span className="text-xl w-7 text-center flex-shrink-0">{p.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-ink">{p.name}</p>
                            <p className="text-xs text-muted mt-0.5">
                              {FREQ_OPTIONS.find(f => f.value === p.frequencyMonths)?.label} · noch {monthsUntil(p.nextDueDate)} Mt.
                            </p>
                          </div>
                          <div className="text-right mr-2">
                            <p className="amount text-[15px] text-ink">{formatCHF(monthlyAmount(p))}/Mt</p>
                            <p className="text-xs text-muted">{formatCHF(p.totalAmount)} total</p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => setEditingId(p.id)} className="text-faint hover:text-pine p-1"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => deleteProvision(p.id)} className="text-faint hover:text-blood p-1"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {provisions.length > 0 && (
                <div className="mt-4 ink-panel rounded-2xl px-5 py-4 flex items-center justify-between">
                  <p className="kicker text-cream/45">Total beiseitelegen</p>
                  <p className="amount text-cream text-xl">{formatCHF(totalMonthly)}<span className="text-cream/40 text-sm font-sans">/Mt</span></p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Gemeinsam tab (kumulierte Abrechnung) ── */}
        {tab === "gemeinsam" && (
          <>
            {debtLoading && !debtData ? (
              <>
                <Skeleton className="h-28 w-full rounded-3xl" />
                <SkeletonList count={4} />
              </>
            ) : debtData ? (
              <>
                {/* Netto-Saldo */}
                {(() => {
                  const partnerOwes = debtData.net > 0
                  const netAmount = Math.abs(debtData.net)
                  return (
                    <div className="ink-panel rounded-3xl p-6" style={{ border: `1px solid ${debtData.partnerColor}55` }}>
                      {netAmount < 0.01 ? (
                        <div className="text-center">
                          <p className="display text-cream text-2xl mb-1">Alles ausgeglichen 🤝</p>
                          <p className="text-cream/50 text-sm">Keine offenen Schulden</p>
                        </div>
                      ) : (
                        <>
                          <p className="kicker mb-2" style={{ color: debtData.partnerColor }}>
                            {partnerOwes ? `${debtData.partnerLabel} schuldet dir` : `Du schuldest ${debtData.partnerLabel}`}
                          </p>
                          <p className="amount text-cream text-[42px]">{formatCHF(netAmount)}</p>
                          {debtData.partnerOwesMe > 0 && debtData.iOwePartner > 0 && (
                            <p className="text-cream/45 text-xs mt-2">
                              {debtData.partnerLabel} schuldet {formatCHF(debtData.partnerOwesMe)} · Du schuldest {formatCHF(debtData.iOwePartner)}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )
                })()}

                {/* Pro Person — wer hat ausgelegt */}
                {byPerson.length > 0 && (
                  <div>
                    <p className="kicker text-muted mb-3">Wer hat ausgelegt</p>
                    <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
                      {byPerson.map((p, i) => {
                        const pct = personTotal > 0 ? (p.total / personTotal) * 100 : 0
                        return (
                          <div key={p.label} className={`px-5 py-4 ${i < byPerson.length - 1 ? "border-b border-rule/60" : ""}`}>
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-cream text-xs font-black flex-shrink-0" style={{ backgroundColor: p.color }}>{p.label[0]}</div>
                              <p className="text-sm font-semibold text-ink flex-1">{p.label}</p>
                              <div className="text-right">
                                <p className="amount text-[15px] text-ink">{formatCHF(p.total)}</p>
                                <p className="text-xs text-muted">{pct.toFixed(0)}%</p>
                              </div>
                            </div>
                            <div className="h-1.5 bg-rule/60 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Pro Kategorie — gemeinsame Ausgaben */}
                <div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <p className="amount text-[34px] text-ink">{formatCHF(sharedCatTotal)}</p>
                    <p className="kicker text-muted">gemeinsam ausgegeben</p>
                  </div>
                  {bySharedCategory.length === 0 ? (
                    <p className="text-muted text-sm text-center py-12">
                      Noch keine geteilten Ausgaben.<br />Scanne eine Quittung und wähle 50/50 oder Nur {debtData.partnerLabel}.
                    </p>
                  ) : (
                    <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
                      {bySharedCategory.map((cat, i) => {
                        const pct = sharedCatTotal > 0 ? (cat.total / sharedCatTotal) * 100 : 0
                        return (
                          <div key={cat.id} className={`px-5 py-4 ${i < bySharedCategory.length - 1 ? "border-b border-rule/60" : ""}`}>
                            <div className="flex items-center gap-3 mb-2.5">
                              <span className="text-xl w-7 text-center">{cat.icon}</span>
                              <p className="text-sm font-semibold text-ink flex-1">{cat.name}</p>
                              <div className="text-right">
                                <p className="amount text-[15px] text-ink">{formatCHF(cat.total)}</p>
                                <p className="text-xs text-muted">{pct.toFixed(0)}%</p>
                              </div>
                            </div>
                            <div className="h-1 bg-rule/60 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
    </PullToRefresh>
  )
}
