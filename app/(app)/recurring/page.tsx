"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { formatCHF, parseAmount } from "@/lib/utils"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { useConfirm } from "@/components/confirm-sheet"
import { SkeletonList } from "@/components/skeleton"
import { useToast } from "@/components/toast"

type Category = { id: string; name: string; icon: string; type: string }
type Account = { id: string; name: string; icon: string; color: string }
type Rule = {
  id: string
  name: string
  amount: number
  dayOfMonth: number
  active: boolean
  category: Category
  user: { name: string; color: string }
  account: Account | null
}

function RuleForm({ categories, accounts, onSave, onCancel }: {
  categories: Category[]
  accounts: Account[]
  onSave: (data: { name: string; amount: string; categoryId: string; dayOfMonth: string; accountId: string | null }) => Promise<void>
  onCancel: () => void
}) {
  const [type, setType] = useState<"expense" | "income">("expense")
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [accountId, setAccountId] = useState("")
  const [dayOfMonth, setDayOfMonth] = useState("1")
  const [saving, setSaving] = useState(false)

  const filtered = categories.filter(c => c.type === type)

  useEffect(() => {
    if (!filtered.find(c => c.id === categoryId)) {
      setCategoryId(filtered[0]?.id ?? "")
    }
  }, [type, filtered, categoryId])

  async function submit() {
    if (!name || !amount || !categoryId) return
    setSaving(true)
    await onSave({ name, amount, categoryId, dayOfMonth, accountId: accountId || null })
    setSaving(false)
  }

  return (
    <div className="bg-card border border-rule shadow-card rounded-2xl p-4 space-y-3">
      <div className="flex gap-2">
        {(["expense", "income"] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              type === t ? (t === "income" ? "bg-pine text-cream" : "bg-ink text-cream") : "bg-paper border border-rule text-muted"
            }`}>
            {t === "expense" ? "Ausgabe" : "Einnahme"}
          </button>
        ))}
      </div>

      <input value={name} onChange={e => setName(e.target.value)}
        placeholder={type === "income" ? "z.B. Lohn, Miete-Einnahme" : "z.B. Netflix, Miete, Spotify"}
        className="w-full bg-paper border border-rule rounded-xl px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-pine/50" />

      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-muted text-xs mb-1">Betrag CHF</p>
          <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-paper border border-rule rounded-xl px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-pine/50" />
        </div>
        <div>
          <p className="text-muted text-xs mb-1">Am</p>
          <div className="flex items-center gap-1 bg-paper border border-rule rounded-xl px-3 py-2">
            <input type="text" inputMode="numeric" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)}
              className="w-8 bg-transparent text-sm text-ink text-center focus:outline-none" />
            <span className="text-muted text-xs">. des Mt.</span>
          </div>
        </div>
      </div>

      {accounts.length > 0 && (
        <div>
          <p className="text-muted text-xs mb-2">Konto</p>
          <div className="flex gap-2 flex-wrap">
            {accounts.map(acc => (
              <button key={acc.id} type="button"
                onClick={() => setAccountId(accountId === acc.id ? "" : acc.id)}
                style={accountId === acc.id ? { backgroundColor: acc.color } : {}}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  accountId === acc.id ? "text-cream shadow-md" : "bg-paper border border-rule text-muted"
                }`}>
                <span>{acc.icon}</span><span>{acc.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-muted text-xs mb-2">Kategorie</p>
        <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto">
          {filtered.map(cat => (
            <button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)}
              className={`rounded-xl p-2 text-center transition-all ${categoryId === cat.id ? "bg-pineSoft ring-1 ring-pine/40" : "bg-paper border border-rule"}`}>
              <div className="text-xl">{cat.icon}</div>
              <div className="text-[10px] text-muted mt-0.5 leading-tight truncate">{cat.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-paper border border-rule text-muted rounded-xl py-2 text-sm font-bold">Abbrechen</button>
        <button onClick={submit} disabled={!name || !amount || !categoryId || saving}
          className="flex-1 bg-pine text-cream rounded-xl py-2 text-sm font-bold disabled:opacity-30">
          {saving ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </div>
  )
}

export default function RecurringPage() {
  const router = useRouter()
  const confirm = useConfirm()
  const toast = useToast()
  const [rules, setRules] = useState<Rule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/recurring").then(r => r.json()),
      fetch("/api/categories").then(r => r.json()),
      fetch("/api/accounts").then(r => r.json()),
    ]).then(([rs, cs, accs]) => {
      setRules(rs)
      setCategories(cs)
      setAccounts(accs)
      setLoading(false)
    })
  }, [])

  async function addRule(data: { name: string; amount: string; categoryId: string; dayOfMonth: string; accountId: string | null }) {
    const parsed = parseAmount(data.amount)
    if (!parsed) {
      toast("Ungültiger Betrag", "error")
      return
    }
    try {
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, amount: parsed }),
      })
      if (!res.ok) throw new Error()
      const rule = await res.json()
      setRules(r => [...r, rule])
      setShowForm(false)
      toast("Regel angelegt")
    } catch {
      toast("Konnte nicht speichern", "error")
    }
  }

  async function deleteRule(id: string) {
    const ok = await confirm({ title: "Regel löschen?", confirmLabel: "Löschen", destructive: true })
    if (!ok) return
    const backup = rules
    setRules(r => r.filter(r => r.id !== id))
    try {
      const res = await fetch(`/api/recurring/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast("Regel gelöscht")
    } catch {
      setRules(backup)
      toast("Konnte nicht gelöscht werden", "error")
    }
  }

  async function setRuleAccount(id: string, accountId: string) {
    const backup = rules
    setRules(rs => rs.map(r => r.id === id
      ? { ...r, account: accounts.find(a => a.id === accountId) ?? null }
      : r))
    try {
      const res = await fetch(`/api/recurring/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: accountId || null }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setRules(rs => rs.map(r => r.id === id ? updated : r))
      toast("Konto aktualisiert — gilt für künftige Buchungen")
    } catch {
      setRules(backup)
      toast("Konnte Konto nicht ändern", "error")
    }
  }

  async function toggleRule(id: string, active: boolean) {
    setRules(rs => rs.map(r => r.id === id ? { ...r, active: !active } : r))
    try {
      const res = await fetch(`/api/recurring/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setRules(rs => rs.map(r => r.id === id ? updated : r))
    } catch {
      setRules(rs => rs.map(r => r.id === id ? { ...r, active } : r))
      toast("Konnte nicht aktualisieren", "error")
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="ink-panel px-6 pt-safe pb-4 sticky top-0 z-10 rounded-b-[28px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-cream/50 hover:text-cream transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <p className="kicker text-cream/45">Regeln</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 text-xs font-bold text-cream active:opacity-70">
            <Plus className="w-3.5 h-3.5" />Neu
          </button>
        </div>
      </div>

      <div className="px-6 pt-4 pb-8 space-y-3">
        {showForm && <RuleForm categories={categories} accounts={accounts} onSave={addRule} onCancel={() => setShowForm(false)} />}

        {loading ? (
          <SkeletonList count={4} />
        ) : rules.length === 0 && !showForm ? (
          <p className="text-muted text-sm text-center py-12">
            Noch keine Regeln.<br />Tippe auf + Neu um eine hinzuzufügen.
          </p>
        ) : (
          <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
            {rules.map((rule, i) => (
              <div key={rule.id}
                className={`flex items-center gap-4 px-5 py-4 ${!rule.active ? "opacity-50" : ""} ${i < rules.length - 1 ? "border-b border-rule/60" : ""}`}>
                <span className="text-xl w-7 text-center flex-shrink-0">{rule.category.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{rule.name}</p>
                  <p className="text-xs text-muted mt-0.5 tabular-nums">
                    <span className={rule.category.type === "income" ? "text-pine font-semibold" : ""}>
                      {rule.category.type === "income" ? "+" : "−"}{formatCHF(rule.amount)}
                    </span>
                    {" · am "}{rule.dayOfMonth}.
                  </p>
                  {accounts.length > 0 && (
                    <select value={rule.account?.id ?? ""}
                      onChange={e => setRuleAccount(rule.id, e.target.value)}
                      className="mt-1.5 bg-paper border border-rule rounded-lg px-2 py-1 text-xs text-muted focus:outline-none focus:border-pine/50 max-w-full"
                      style={rule.account ? { color: rule.account.color, fontWeight: 600 } : {}}>
                      <option value="">Kein Konto</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.icon} {acc.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <button onClick={() => toggleRule(rule.id, rule.active)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg ${rule.active ? "bg-pineSoft text-pine" : "bg-paper border border-rule text-faint"}`}>
                  {rule.active ? "AKTIV" : "PAUSE"}
                </button>
                <button onClick={() => deleteRule(rule.id)} className="text-faint hover:text-blood p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
