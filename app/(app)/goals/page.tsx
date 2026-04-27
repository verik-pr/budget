"use client"

import { useEffect, useState } from "react"
import { formatCHF } from "@/lib/utils"
import { Plus, Trash2, Target } from "lucide-react"

type Goal = { id: string; name: string; icon: string; targetAmount: number; savedAmount: number }

const ICONS = ["🎯", "✈️", "🏠", "🚗", "💍", "📱", "🏖️", "🎓", "🛋️", "🎸"]

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("🎯")
  const [targetAmount, setTargetAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch("/api/savings-goals").then(r => r.json()).then(setGoals)
  }, [])

  async function createGoal(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/savings-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon, targetAmount }),
    })
    const goal = await res.json()
    setGoals(g => [...g, goal])
    setName(""); setTargetAmount(""); setIcon("🎯"); setShowForm(false); setSaving(false)
  }

  async function addAmount(goal: Goal) {
    const add = parseFloat(adding[goal.id] || "0")
    if (!add || add <= 0) return
    const res = await fetch(`/api/savings-goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ savedAmount: goal.savedAmount + add }),
    })
    const updated = await res.json()
    setGoals(gs => gs.map(g => g.id === goal.id ? updated : g))
    setAdding(a => ({ ...a, [goal.id]: "" }))
  }

  async function deleteGoal(id: string) {
    if (!confirm("Sparziel löschen?")) return
    await fetch(`/api/savings-goals/${id}`, { method: "DELETE" })
    setGoals(gs => gs.filter(g => g.id !== id))
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white border-b border-gray-100 px-4 pt-14 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sparziele</h1>
          <p className="text-xs text-gray-400 mt-0.5">Ziele verfolgen</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="bg-green-600 text-white rounded-xl px-3 py-2 flex items-center gap-1.5 text-sm font-medium">
          <Plus className="w-4 h-4" /> Neues Ziel
        </button>
      </div>

      {showForm && (
        <form onSubmit={createGoal} className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
            <input required value={name} onChange={e => setName(e.target.value)}
              placeholder="z.B. Urlaub, MacBook, Auto"
              className="w-full text-sm text-gray-900 focus:outline-none" />
          </div>
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="block text-xs font-medium text-gray-400 mb-2">Icon</label>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map(i => (
                <button key={i} type="button" onClick={() => setIcon(i)}
                  className={`text-2xl p-1.5 rounded-xl border-2 transition-all ${icon === i ? "border-green-500 bg-green-50" : "border-transparent"}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="block text-xs font-medium text-gray-400 mb-1">Zielbetrag (CHF)</label>
            <input type="number" step="0.01" min="1" required value={targetAmount}
              onChange={e => setTargetAmount(e.target.value)}
              placeholder="0.00" className="w-full text-sm text-gray-900 focus:outline-none" />
          </div>
          <div className="px-4 py-3 flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Abbrechen</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-50">
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </form>
      )}

      <div className="px-4 py-4 space-y-3">
        {goals.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <Target className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Noch keine Sparziele</p>
          </div>
        ) : goals.map(goal => {
          const pct = Math.min((goal.savedAmount / goal.targetAmount) * 100, 100)
          const remaining = goal.targetAmount - goal.savedAmount
          const done = pct >= 100
          return (
            <div key={goal.id} className="bg-white rounded-2xl px-4 py-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{goal.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900">{goal.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatCHF(goal.savedAmount)} von {formatCHF(goal.targetAmount)}
                    </p>
                  </div>
                </div>
                <button onClick={() => deleteGoal(goal.id)} className="text-gray-200 hover:text-red-400 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div className={`h-full rounded-full transition-all ${done ? "bg-green-500" : "bg-emerald-400"}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between mb-3">
                <p className="text-xs text-gray-400">{pct.toFixed(0)}%</p>
                {!done && <p className="text-xs text-gray-400">Noch {formatCHF(remaining)}</p>}
                {done && <p className="text-xs text-green-600 font-medium">Erreicht!</p>}
              </div>

              {!done && (
                <div className="flex gap-2">
                  <input type="number" step="0.01" min="0.01"
                    value={adding[goal.id] || ""}
                    onChange={e => setAdding(a => ({ ...a, [goal.id]: e.target.value }))}
                    placeholder="Betrag einzahlen"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <button onClick={() => addAmount(goal)}
                    className="bg-green-600 text-white px-4 rounded-xl text-sm font-medium">
                    +
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
