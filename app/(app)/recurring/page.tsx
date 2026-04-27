"use client"

import { useEffect, useState } from "react"
import { formatCHF } from "@/lib/utils"
import { Plus, Trash2, RefreshCw } from "lucide-react"

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

export default function RecurringPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [dayOfMonth, setDayOfMonth] = useState("1")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/recurring").then(r => r.json()).then(setRules)
    fetch("/api/categories").then(r => r.json()).then((data: Category[]) => {
      setCategories(data)
      if (data.length > 0) setCategoryId(data[0].id)
    })
  }, [])

  async function addRule(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, amount, categoryId, dayOfMonth }),
    })
    const rule = await res.json()
    setRules(r => [...r, rule])
    setName(""); setAmount(""); setDayOfMonth("1"); setShowForm(false)
    setSaving(false)
  }

  async function deleteRule(id: string) {
    if (!confirm("Regel löschen?")) return
    await fetch(`/api/recurring/${id}`, { method: "DELETE" })
    setRules(r => r.filter(r => r.id !== id))
  }

  async function toggleRule(id: string, active: boolean) {
    const res = await fetch(`/api/recurring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    })
    const updated = await res.json()
    setRules(rs => rs.map(r => r.id === id ? updated : r))
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white border-b border-gray-100 px-4 pt-14 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Regeln</h1>
          <p className="text-xs text-gray-400 mt-0.5">Wiederkehrende Buchungen</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="bg-green-600 text-white rounded-xl px-3 py-2 flex items-center gap-1.5 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Neue Regel
        </button>
      </div>

      {showForm && (
        <form onSubmit={addRule} className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
            <input
              required value={name} onChange={e => setName(e.target.value)}
              placeholder="z.B. Lohn, Netflix, Miete"
              className="w-full text-sm text-gray-900 focus:outline-none"
            />
          </div>
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="block text-xs font-medium text-gray-400 mb-1">Betrag (CHF)</label>
            <input
              type="number" step="0.01" min="0.01" required
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full text-sm text-gray-900 focus:outline-none"
            />
          </div>
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="block text-xs font-medium text-gray-400 mb-1">Am wievielten des Monats</label>
            <input
              type="number" min="1" max="28" required
              value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)}
              className="w-full text-sm text-gray-900 focus:outline-none"
            />
          </div>
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="block text-xs font-medium text-gray-400 mb-2">Kategorie</label>
            <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
              {categories.map(cat => (
                <button
                  key={cat.id} type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={`rounded-xl p-2 text-center border-2 transition-all ${categoryId === cat.id ? "border-green-500 bg-green-50" : "border-transparent bg-gray-50"}`}
                >
                  <div className="text-xl">{cat.icon}</div>
                  <div className="text-xs text-gray-700 mt-0.5 leading-tight truncate">{cat.name}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 py-3 flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Abbrechen</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-50">
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </form>
      )}

      <div className="px-4 py-4 space-y-2">
        {rules.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <RefreshCw className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Noch keine Regeln</p>
          </div>
        ) : rules.map(rule => (
          <div key={rule.id} className={`bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 ${!rule.active ? "opacity-50" : ""}`}>
            <span className="text-2xl">{rule.category.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{rule.name}</p>
              <p className="text-xs text-gray-400">
                {rule.category.type === "income" ? "+" : "-"}{formatCHF(rule.amount)} · am {rule.dayOfMonth}. des Monats
              </p>
            </div>
            <button onClick={() => toggleRule(rule.id, rule.active)} className={`text-xs font-medium px-2 py-1 rounded-lg ${rule.active ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
              {rule.active ? "Aktiv" : "Pausiert"}
            </button>
            <button onClick={() => deleteRule(rule.id)} className="text-gray-300 hover:text-red-400 p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
