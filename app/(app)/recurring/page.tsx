"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { formatCHF } from "@/lib/utils"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { useConfirm } from "@/components/confirm-sheet"
import { SkeletonList } from "@/components/skeleton"
import { useToast } from "@/components/toast"

type Category = { id: string; name: string; icon: string; type: string }
type Rule = {
  id: string
  name: string
  amount: number
  dayOfMonth: number
  active: boolean
  category: Category
  user: { name: string; color: string }
}

function RuleForm({ categories, onSave, onCancel }: {
  categories: Category[]
  onSave: (data: { name: string; amount: string; categoryId: string; dayOfMonth: string }) => Promise<void>
  onCancel: () => void
}) {
  const [type, setType] = useState<"expense" | "income">("expense")
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState("")
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
    await onSave({ name, amount, categoryId, dayOfMonth })
    setSaving(false)
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
      <div className="flex gap-2">
        {(["expense", "income"] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              type === t ? (t === "income" ? "bg-green-500 text-black" : "bg-white text-black") : "bg-zinc-800 text-zinc-400"
            }`}>
            {t === "expense" ? "Ausgabe" : "Einnahme"}
          </button>
        ))}
      </div>

      <input value={name} onChange={e => setName(e.target.value)}
        placeholder={type === "income" ? "z.B. Lohn, Miete-Einnahme" : "z.B. Netflix, Miete, Spotify"}
        className="w-full bg-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none" />

      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-zinc-600 text-xs mb-1">Betrag CHF</p>
          <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none" />
        </div>
        <div>
          <p className="text-zinc-600 text-xs mb-1">Am</p>
          <div className="flex items-center gap-1 bg-zinc-800 rounded-xl px-3 py-2">
            <input type="text" inputMode="numeric" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)}
              className="w-8 bg-transparent text-sm text-white text-center focus:outline-none" />
            <span className="text-zinc-500 text-xs">. des Mt.</span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-zinc-600 text-xs mb-2">Kategorie</p>
        <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto">
          {filtered.map(cat => (
            <button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)}
              className={`rounded-xl p-2 text-center transition-all ${categoryId === cat.id ? "bg-zinc-700" : "bg-zinc-800"}`}>
              <div className="text-xl">{cat.icon}</div>
              <div className="text-[10px] text-zinc-400 mt-0.5 leading-tight truncate">{cat.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-zinc-800 text-zinc-400 rounded-xl py-2 text-sm font-bold">Abbrechen</button>
        <button onClick={submit} disabled={!name || !amount || !categoryId || saving}
          className="flex-1 bg-green-500 text-black rounded-xl py-2 text-sm font-bold disabled:opacity-30">
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
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/recurring").then(r => r.json()),
      fetch("/api/categories").then(r => r.json()),
    ]).then(([rs, cs]) => {
      setRules(rs)
      setCategories(cs)
      setLoading(false)
    })
  }, [])

  async function addRule(data: { name: string; amount: string; categoryId: string; dayOfMonth: string }) {
    try {
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
      <div className="bg-black px-6 pt-safe pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <p className="text-zinc-500 text-xs font-semibold tracking-widest uppercase">Regeln</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 text-xs font-bold text-green-500 active:opacity-70">
            <Plus className="w-3.5 h-3.5" />Neu
          </button>
        </div>
      </div>

      <div className="px-6 pt-4 pb-8 space-y-3">
        {showForm && <RuleForm categories={categories} onSave={addRule} onCancel={() => setShowForm(false)} />}

        {loading ? (
          <SkeletonList count={4} />
        ) : rules.length === 0 && !showForm ? (
          <p className="text-zinc-500 text-sm text-center py-12">
            Noch keine Regeln.<br />Tippe auf + Neu um eine hinzuzufügen.
          </p>
        ) : (
          <div className="bg-white rounded-3xl overflow-hidden">
            {rules.map((rule, i) => (
              <div key={rule.id}
                className={`flex items-center gap-4 px-5 py-4 ${!rule.active ? "opacity-50" : ""} ${i < rules.length - 1 ? "border-b border-gray-100" : ""}`}>
                <span className="text-xl w-7 text-center flex-shrink-0">{rule.category.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{rule.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 tabular-nums">
                    <span className={rule.category.type === "income" ? "text-green-500 font-semibold" : ""}>
                      {rule.category.type === "income" ? "+" : "−"}{formatCHF(rule.amount)}
                    </span>
                    {" · am "}{rule.dayOfMonth}.
                  </p>
                </div>
                <button onClick={() => toggleRule(rule.id, rule.active)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg ${rule.active ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                  {rule.active ? "AKTIV" : "PAUSE"}
                </button>
                <button onClick={() => deleteRule(rule.id)} className="text-gray-200 hover:text-red-400 p-1">
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
