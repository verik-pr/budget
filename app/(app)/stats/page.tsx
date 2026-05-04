"use client"

import { useEffect, useState } from "react"
import { formatCHF } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, X, Check } from "lucide-react"
import { CONTRIBUTORS } from "@/lib/utils"
import { useSession } from "next-auth/react"

type Transaction = {
  amount: number
  contributor: string | null
  user: { name: string }
  category: { id: string; name: string; icon: string; type: string }
}
type Account = { id: string; name: string; icon: string; color: string; type: string; dueDay: number | null; ownerName: string | null }
type CategoryStat = { id: string; name: string; icon: string; total: number }
type PersonStat = { label: string; color: string; total: number }
type Provision = { id: string; name: string; icon: string; totalAmount: number; frequencyMonths: number; nextDueDate: string }

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
    <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
      <div className="flex gap-2">
        <input value={icon} onChange={e => setIcon(e.target.value)}
          className="w-14 bg-zinc-800 rounded-xl px-3 py-2 text-xl text-center focus:outline-none" />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (z.B. ÖV-Abo)"
          className="flex-1 bg-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none" />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-zinc-600 text-xs mb-1">Betrag CHF</p>
          <input type="text" inputMode="decimal" value={totalAmount} onChange={e => setTotalAmount(e.target.value)}
            placeholder="1200.00"
            className="w-full bg-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none" />
        </div>
        <div className="flex-1">
          <p className="text-zinc-600 text-xs mb-1">Frequenz</p>
          <select value={frequencyMonths} onChange={e => setFrequencyMonths(parseInt(e.target.value))}
            className="w-full bg-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none">
            {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p className="text-zinc-600 text-xs mb-1">Nächste Fälligkeit</p>
        <input type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)}
          className="w-full bg-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none" />
      </div>
      {totalAmount && (
        <p className="text-zinc-500 text-xs">
          = CHF {(parseFloat(totalAmount) / frequencyMonths).toFixed(2)}/Monat beiseitelegen
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-zinc-800 text-zinc-400 rounded-xl py-2 text-sm font-bold">Abbrechen</button>
        <button
          onClick={() => { if (name && totalAmount && nextDueDate) onSave({ name, icon, totalAmount: parseFloat(totalAmount), frequencyMonths, nextDueDate }) }}
          disabled={!name || !totalAmount || !nextDueDate}
          className="flex-1 bg-green-500 text-black rounded-xl py-2 text-sm font-bold disabled:opacity-30">
          Speichern
        </button>
      </div>
    </div>
  )
}

export default function StatsPage() {
  const { data: session } = useSession()
  const [periodStart, setPeriodStart] = useState<Date>(initialPeriodStart)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [tab, setTab] = useState<"expense" | "income" | "planung">("expense")
  const [loading, setLoading] = useState(true)

  // Credit cards
  const [creditAccounts, setCreditAccounts] = useState<(Account & { balance: number })[]>([])

  // Provisions
  const [provisions, setProvisions] = useState<Provision[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/accounts?mine=true")
      .then(r => r.json())
      .then(({ accounts: accs }: { accounts: Account[]; defaultId: string | null }) => {
        setAccounts(accs.filter(a => a.type !== "credit"))
        const credits = accs.filter(a => a.type === "credit")
        // Fetch balances for credit cards
        Promise.all(credits.map(async acc => {
          const now = new Date()
          const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          const params = new URLSearchParams({ startDate: start.toISOString(), endDate: end.toISOString(), accountId: acc.id })
          const txs = await fetch(`/api/transactions?${params}`).then(r => r.json())
          const balance = txs.reduce((s: number, t: { amount: number }) => s + t.amount, 0)
          return { ...acc, balance }
        })).then(setCreditAccounts)
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

  useEffect(() => {
    if (tab === "planung") {
      fetch("/api/provisions").then(r => r.json()).then(setProvisions)
    }
  }, [tab])

  async function createProvision(data: Omit<Provision, "id">) {
    const res = await fetch("/api/provisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
    const p = await res.json()
    setProvisions(prev => [...prev, p])
    setShowForm(false)
  }

  async function updateProvision(id: string, data: Omit<Provision, "id">) {
    const res = await fetch(`/api/provisions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
    const p = await res.json()
    setProvisions(prev => prev.map(x => x.id === id ? p : x))
    setEditingId(null)
  }

  async function deleteProvision(id: string) {
    if (!confirm("Rückstellung löschen?")) return
    await fetch(`/api/provisions/${id}`, { method: "DELETE" })
    setProvisions(prev => prev.filter(x => x.id !== id))
  }

  function prevPeriod() { setPeriodStart(p => new Date(p.getFullYear(), p.getMonth() - 1, 24)) }
  function nextPeriod() { setPeriodStart(p => new Date(p.getFullYear(), p.getMonth() + 1, 24)) }

  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 24)
  const lastDay = new Date(periodEnd.getTime() - 86400000)
  const periodLabel = `${periodStart.getDate()}. ${periodStart.toLocaleDateString("de-CH", { month: "short" })} – ${lastDay.getDate()}. ${lastDay.toLocaleDateString("de-CH", { month: "short", year: "numeric" })}`

  const firstName = session?.user?.name?.split(" ")[0]?.toLowerCase() ?? ""
  const myContrib = CONTRIBUTORS.find(c => c.label.toLowerCase().startsWith(firstName))

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

  const byPerson: PersonStat[] = (() => {
    const map: Record<string, PersonStat> = {}
    const myName = session?.user?.name?.split(" ")[0] ?? "Ich"
    for (const t of expenses) {
      const key = t.contributor ?? "__me__"
      if (!map[key]) {
        const contrib = CONTRIBUTORS.find(c => c.value === t.contributor)
        map[key] = { label: contrib ? contrib.label.split(" ")[0] : myName, color: contrib?.color ?? myContrib?.color ?? "#6366f1", total: 0 }
      }
      map[key].total += t.amount
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  })()
  const personTotal = byPerson.reduce((s, p) => s + p.total, 0)

  const totalMonthly = provisions.reduce((s, p) => s + monthlyAmount(p), 0)
  const nextDueDate = (acc: Account & { balance: number }) => {
    const now = new Date()
    const day = acc.dueDay ?? 15
    let due = new Date(now.getFullYear(), now.getMonth(), day)
    if (due <= now) due = new Date(now.getFullYear(), now.getMonth() + 1, day)
    return due.toLocaleDateString("de-CH", { day: "numeric", month: "short" })
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-black px-6 pt-safe pb-4 sticky top-0 z-10">
        {tab !== "planung" && (
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevPeriod} className="text-zinc-400 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <p className="text-white font-bold text-sm">{periodLabel}</p>
            <button onClick={nextPeriod} className="text-zinc-400 hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
        {tab !== "planung" && accounts.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {accounts.map(acc => (
              <button key={acc.id} type="button"
                onClick={() => setAccountId(acc.id)}
                style={accountId === acc.id ? { backgroundColor: acc.color } : {}}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${accountId === acc.id ? "text-white" : "bg-zinc-800 text-zinc-400"}`}>
                <span>{acc.icon}</span><span>{acc.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {(["expense", "income", "planung"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${tab === t ? "bg-white text-black" : "bg-zinc-900 text-zinc-500"}`}>
              {t === "expense" ? "Ausgaben" : t === "income" ? "Einnahmen" : "Planung"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pt-6 space-y-6 pb-8">

        {/* ── Ausgaben / Einnahmen tabs ── */}
        {(tab === "expense" || tab === "income") && (
          <>
            {!loading && byPerson.length > 1 && tab === "expense" && (
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Wer hat mehr ausgegeben</p>
                <div className="bg-white rounded-3xl overflow-hidden">
                  {byPerson.map((p, i) => {
                    const pct = personTotal > 0 ? (p.total / personTotal) * 100 : 0
                    return (
                      <div key={p.label} className={`px-5 py-4 ${i < byPerson.length - 1 ? "border-b border-gray-100" : ""}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0" style={{ backgroundColor: p.color }}>{p.label[0]}</div>
                          <p className="text-sm font-semibold text-gray-900 flex-1">{p.label}</p>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900 tabular-nums">{formatCHF(p.total)}</p>
                            <p className="text-xs text-gray-400">{pct.toFixed(0)}%</p>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

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
                          <div className={`h-full rounded-full ${tab === "expense" ? "bg-gray-900" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Planung tab ── */}
        {tab === "planung" && (
          <>
            {/* Credit cards */}
            {creditAccounts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">💳 Kreditkarten</p>
                <div className="bg-white rounded-3xl overflow-hidden">
                  {creditAccounts.map((acc, i) => (
                    <div key={acc.id} className={`flex items-center gap-4 px-5 py-4 ${i < creditAccounts.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: acc.color + "20" }}>
                        {acc.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{acc.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {acc.ownerName && <span>{acc.ownerName} · </span>}
                          fällig {nextDueDate(acc)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-gray-900">{formatCHF(acc.balance)}</p>
                        <p className="text-xs text-gray-400">offen</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Provisions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">🗓 Rückstellungen</p>
                <button onClick={() => setShowForm(true)}
                  className="flex items-center gap-1 text-xs font-bold text-green-500 active:opacity-70">
                  <Plus className="w-3.5 h-3.5" />Neu
                </button>
              </div>

              {showForm && (
                <div className="mb-3">
                  <ProvisionForm onSave={createProvision} onCancel={() => setShowForm(false)} />
                </div>
              )}

              {provisions.length === 0 && !showForm ? (
                <p className="text-zinc-600 text-sm text-center py-8">Noch keine Rückstellungen.<br />Tippe auf + Neu um eine hinzuzufügen.</p>
              ) : (
                <div className="bg-white rounded-3xl overflow-hidden">
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
                        <div className={`flex items-center gap-4 px-5 py-4 ${i < provisions.length - 1 ? "border-b border-gray-100" : ""}`}>
                          <span className="text-xl w-7 text-center flex-shrink-0">{p.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {FREQ_OPTIONS.find(f => f.value === p.frequencyMonths)?.label} · noch {monthsUntil(p.nextDueDate)} Mt.
                            </p>
                          </div>
                          <div className="text-right mr-2">
                            <p className="text-sm font-bold text-gray-900 tabular-nums">{formatCHF(monthlyAmount(p))}/Mt</p>
                            <p className="text-xs text-gray-400">{formatCHF(p.totalAmount)} total</p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => setEditingId(p.id)} className="text-gray-300 hover:text-blue-400 p-1"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => deleteProvision(p.id)} className="text-gray-200 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {provisions.length > 0 && (
                <div className="mt-4 bg-zinc-900 rounded-2xl px-5 py-4 flex items-center justify-between">
                  <p className="text-zinc-400 text-sm font-semibold">Total beiseitelegen</p>
                  <p className="text-white text-xl font-black tabular-nums">{formatCHF(totalMonthly)}<span className="text-zinc-500 text-sm font-normal">/Mt</span></p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
