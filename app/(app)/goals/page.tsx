"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { formatCHF } from "@/lib/utils"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { useConfirm } from "@/components/confirm-sheet"
import { SkeletonList } from "@/components/skeleton"

type Goal = { id: string; name: string; icon: string; targetAmount: number; savedAmount: number }

const ICONS = ["🎯", "✈️", "🏠", "🚗", "💍", "📱", "🏖️", "🎓", "🛋️", "🎸"]

function GoalForm({ onSave, onCancel }: {
  onSave: (data: { name: string; icon: string; targetAmount: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("🎯")
  const [targetAmount, setTargetAmount] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!name || !targetAmount) return
    setSaving(true)
    await onSave({ name, icon, targetAmount })
    setSaving(false)
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
      <div className="flex gap-2">
        <input value={icon} onChange={e => setIcon(e.target.value)}
          className="w-14 bg-zinc-800 rounded-xl px-3 py-2 text-xl text-center focus:outline-none" />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Urlaub, MacBook"
          className="flex-1 bg-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none" />
      </div>
      <div>
        <p className="text-zinc-600 text-xs mb-2">Icon</p>
        <div className="flex gap-1.5 flex-wrap">
          {ICONS.map(i => (
            <button key={i} type="button" onClick={() => setIcon(i)}
              className={`text-xl p-1.5 rounded-xl transition-all ${icon === i ? "bg-zinc-700" : ""}`}>
              {i}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-zinc-600 text-xs mb-1">Zielbetrag CHF</p>
        <input type="text" inputMode="decimal" value={targetAmount} onChange={e => setTargetAmount(e.target.value)}
          placeholder="2000.00"
          className="w-full bg-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-zinc-800 text-zinc-400 rounded-xl py-2 text-sm font-bold">Abbrechen</button>
        <button onClick={submit} disabled={!name || !targetAmount || saving}
          className="flex-1 bg-green-500 text-black rounded-xl py-2 text-sm font-bold disabled:opacity-30">
          {saving ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </div>
  )
}

export default function GoalsPage() {
  const router = useRouter()
  const confirm = useConfirm()
  const [goals, setGoals] = useState<Goal[]>([])
  const [showForm, setShowForm] = useState(false)
  const [adding, setAdding] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/savings-goals").then(r => r.json()).then(data => {
      setGoals(data)
      setLoading(false)
    })
  }, [])

  async function createGoal(data: { name: string; icon: string; targetAmount: string }) {
    const res = await fetch("/api/savings-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const goal = await res.json()
    setGoals(g => [...g, goal])
    setShowForm(false)
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
    const ok = await confirm({ title: "Sparziel löschen?", confirmLabel: "Löschen", destructive: true })
    if (!ok) return
    await fetch(`/api/savings-goals/${id}`, { method: "DELETE" })
    setGoals(gs => gs.filter(g => g.id !== id))
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-black px-6 pt-safe pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <p className="text-zinc-500 text-xs font-semibold tracking-widest uppercase">Sparziele</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 text-xs font-bold text-green-500 active:opacity-70">
            <Plus className="w-3.5 h-3.5" />Neu
          </button>
        </div>
      </div>

      <div className="px-6 pt-4 pb-8 space-y-3">
        {showForm && <GoalForm onSave={createGoal} onCancel={() => setShowForm(false)} />}

        {loading ? (
          <SkeletonList count={3} />
        ) : goals.length === 0 && !showForm ? (
          <p className="text-zinc-500 text-sm text-center py-12">
            Noch keine Sparziele.<br />Tippe auf + Neu um eines hinzuzufügen.
          </p>
        ) : (
          goals.map(goal => {
            const pct = Math.min((goal.savedAmount / goal.targetAmount) * 100, 100)
            const remaining = goal.targetAmount - goal.savedAmount
            const done = pct >= 100
            return (
              <div key={goal.id} className="bg-white rounded-3xl px-5 py-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{goal.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{goal.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatCHF(goal.savedAmount)} von {formatCHF(goal.targetAmount)}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => deleteGoal(goal.id)} className="text-gray-200 hover:text-red-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                  <div className={`h-full rounded-full transition-all ${done ? "bg-green-500" : "bg-gray-900"}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between mb-3">
                  <p className="text-xs text-gray-400 tabular-nums">{pct.toFixed(0)}%</p>
                  {!done ? (
                    <p className="text-xs text-gray-400 tabular-nums">Noch {formatCHF(remaining)}</p>
                  ) : (
                    <p className="text-xs text-green-600 font-semibold">Erreicht!</p>
                  )}
                </div>

                {!done && (
                  <div className="flex gap-2">
                    <input type="text" inputMode="decimal"
                      value={adding[goal.id] || ""}
                      onChange={e => setAdding(a => ({ ...a, [goal.id]: e.target.value }))}
                      placeholder="Betrag einzahlen"
                      className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none" />
                    <button onClick={() => addAmount(goal)}
                      className="bg-green-500 text-black w-10 rounded-xl text-base font-bold active:opacity-70">
                      +
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
