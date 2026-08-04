"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { formatCHF, parseAmount } from "@/lib/utils"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { useConfirm } from "@/components/confirm-sheet"
import { SkeletonList } from "@/components/skeleton"
import { useToast } from "@/components/toast"

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
    <div className="bg-card border border-rule shadow-card rounded-2xl p-4 space-y-3">
      <div className="flex gap-2">
        <input value={icon} onChange={e => setIcon(e.target.value)}
          className="w-14 bg-paper border border-rule rounded-xl px-3 py-2 text-xl text-center focus:outline-none focus:border-pine/50" />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Urlaub, MacBook"
          className="flex-1 bg-paper border border-rule rounded-xl px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-pine/50" />
      </div>
      <div>
        <p className="text-muted text-xs mb-2">Icon</p>
        <div className="flex gap-1.5 flex-wrap">
          {ICONS.map(i => (
            <button key={i} type="button" onClick={() => setIcon(i)}
              className={`text-xl p-1.5 rounded-xl transition-all ${icon === i ? "bg-pineSoft ring-1 ring-pine/40" : ""}`}>
              {i}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-muted text-xs mb-1">Zielbetrag CHF</p>
        <input type="text" inputMode="decimal" value={targetAmount} onChange={e => setTargetAmount(e.target.value)}
          placeholder="2000.00"
          className="w-full bg-paper border border-rule rounded-xl px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-pine/50" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-paper border border-rule text-muted rounded-xl py-2 text-sm font-bold">Abbrechen</button>
        <button onClick={submit} disabled={!name || !targetAmount || saving}
          className="flex-1 bg-pine text-cream rounded-xl py-2 text-sm font-bold disabled:opacity-30">
          {saving ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </div>
  )
}

export default function GoalsPage() {
  const router = useRouter()
  const confirm = useConfirm()
  const toast = useToast()
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
    try {
      const res = await fetch("/api/savings-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      const goal = await res.json()
      setGoals(g => [...g, goal])
      setShowForm(false)
      toast("Sparziel angelegt")
    } catch {
      toast("Konnte nicht speichern", "error")
    }
  }

  async function addAmount(goal: Goal) {
    const add = parseAmount(adding[goal.id] || "")
    if (!add) return
    try {
      const res = await fetch(`/api/savings-goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedAmount: goal.savedAmount + add }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setGoals(gs => gs.map(g => g.id === goal.id ? updated : g))
      setAdding(a => ({ ...a, [goal.id]: "" }))
      toast(`+${add.toFixed(2)} CHF eingezahlt`)
    } catch {
      toast("Konnte nicht speichern", "error")
    }
  }

  async function deleteGoal(id: string) {
    const ok = await confirm({ title: "Sparziel löschen?", confirmLabel: "Löschen", destructive: true })
    if (!ok) return
    const backup = goals
    setGoals(gs => gs.filter(g => g.id !== id))
    try {
      const res = await fetch(`/api/savings-goals/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast("Sparziel gelöscht")
    } catch {
      setGoals(backup)
      toast("Konnte nicht gelöscht werden", "error")
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
            <p className="kicker text-cream/45">Sparziele</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 text-xs font-bold text-cream active:opacity-70">
            <Plus className="w-3.5 h-3.5" />Neu
          </button>
        </div>
      </div>

      <div className="px-6 pt-4 pb-8 space-y-3">
        {showForm && <GoalForm onSave={createGoal} onCancel={() => setShowForm(false)} />}

        {loading ? (
          <SkeletonList count={3} />
        ) : goals.length === 0 && !showForm ? (
          <p className="text-muted text-sm text-center py-12">
            Noch keine Sparziele.<br />Tippe auf + Neu um eines hinzuzufügen.
          </p>
        ) : (
          goals.map(goal => {
            const pct = Math.min((goal.savedAmount / goal.targetAmount) * 100, 100)
            const remaining = goal.targetAmount - goal.savedAmount
            const done = pct >= 100
            return (
              <div key={goal.id} className="bg-card border border-rule shadow-card rounded-3xl px-5 py-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{goal.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{goal.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {formatCHF(goal.savedAmount)} von {formatCHF(goal.targetAmount)}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => deleteGoal(goal.id)} className="text-faint hover:text-blood p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-1.5 bg-rule/60 rounded-full overflow-hidden mb-1.5">
                  <div className={`h-full rounded-full transition-all ${done ? "bg-pine" : "bg-ink"}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between mb-3">
                  <p className="text-xs text-muted tabular-nums">{pct.toFixed(0)}%</p>
                  {!done ? (
                    <p className="text-xs text-muted tabular-nums">Noch {formatCHF(remaining)}</p>
                  ) : (
                    <p className="text-xs text-pine font-semibold">Erreicht!</p>
                  )}
                </div>

                {!done && (
                  <div className="flex gap-2">
                    <input type="text" inputMode="decimal"
                      value={adding[goal.id] || ""}
                      onChange={e => setAdding(a => ({ ...a, [goal.id]: e.target.value }))}
                      placeholder="Betrag einzahlen"
                      className="flex-1 bg-paper border border-rule rounded-xl px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-pine/50" />
                    <button onClick={() => addAmount(goal)}
                      className="bg-pine text-cream w-10 rounded-xl text-base font-bold active:opacity-70">
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
