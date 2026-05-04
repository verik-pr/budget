"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Trash2, Pencil, Check } from "lucide-react"
import { CONTRIBUTORS } from "@/lib/utils"

type CreditAccount = {
  id: string
  name: string
  icon: string
  color: string
  type: string
  dueDay: number | null
  ownerName: string | null
}

const COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"
]

const OWNERS = ["", ...CONTRIBUTORS.map(c => c.label.split(" ")[0])]

function CardForm({ initial, onSave, onCancel }: {
  initial?: Partial<CreditAccount>
  onSave: (data: Omit<CreditAccount, "id">) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [icon, setIcon] = useState(initial?.icon ?? "💳")
  const [color, setColor] = useState(initial?.color ?? "#6366f1")
  const [dueDay, setDueDay] = useState(initial?.dueDay?.toString() ?? "15")
  const [ownerName, setOwnerName] = useState(initial?.ownerName ?? "")

  return (
    <div className="bg-zinc-900 rounded-2xl p-4 space-y-4">
      <div className="flex gap-2">
        <input value={icon} onChange={e => setIcon(e.target.value)}
          className="w-14 bg-zinc-800 rounded-xl px-3 py-2.5 text-xl text-center focus:outline-none" />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Visa Erik"
          className="flex-1 bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none" />
      </div>

      <div>
        <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-2">Farbe</p>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full transition-all flex items-center justify-center"
              style={{ backgroundColor: c }}>
              {color === c && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-2">Wessen Karte</p>
          <div className="flex gap-2 flex-wrap">
            {OWNERS.map(o => (
              <button key={o} type="button"
                onClick={() => setOwnerName(o)}
                style={ownerName === o ? { backgroundColor: CONTRIBUTORS.find(c => c.label.startsWith(o))?.color ?? "#6366f1" } : {}}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${ownerName === o ? "text-white" : "bg-zinc-800 text-zinc-400"}`}>
                {o || "Beide"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-2">Fällig am</p>
          <div className="flex items-center gap-1 bg-zinc-800 rounded-xl px-3 py-2.5">
            <input type="text" inputMode="numeric" value={dueDay} onChange={e => setDueDay(e.target.value)}
              className="w-8 bg-transparent text-sm text-white text-center focus:outline-none" />
            <span className="text-zinc-500 text-xs">. des Monats</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-zinc-800 text-zinc-400 rounded-xl py-2.5 text-sm font-bold">Abbrechen</button>
        <button
          onClick={() => { if (name) onSave({ name, icon, color, type: "credit", dueDay: parseInt(dueDay) || 15, ownerName: ownerName || null }) }}
          disabled={!name}
          className="flex-1 bg-green-500 text-black rounded-xl py-2.5 text-sm font-bold disabled:opacity-30">
          Speichern
        </button>
      </div>
    </div>
  )
}

export default function KreditkartenPage() {
  const router = useRouter()
  const [cards, setCards] = useState<CreditAccount[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/accounts")
      .then(r => r.json())
      .then((all: (CreditAccount & { type: string })[]) => {
        setCards(all.filter(a => a.type === "credit"))
        setLoading(false)
      })
  }, [])

  async function createCard(data: Omit<CreditAccount, "id">) {
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const card = await res.json()
    setCards(prev => [...prev, card])
    setShowForm(false)
  }

  async function updateCard(id: string, data: Omit<CreditAccount, "id">) {
    const res = await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const card = await res.json()
    setCards(prev => prev.map(c => c.id === id ? card : c))
    setEditingId(null)
  }

  async function deleteCard(id: string) {
    if (!confirm("Kreditkarte löschen?")) return
    await fetch(`/api/accounts/${id}`, { method: "DELETE" })
    setCards(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-black">
      <div className="px-6 pt-safe pb-8">

        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="text-zinc-500 text-xs font-semibold tracking-widest uppercase">Kreditkarten</p>
        </div>

        <div className="space-y-3">
          {loading ? (
            <p className="text-zinc-600 text-sm text-center py-8">Laden…</p>
          ) : cards.length === 0 && !showForm ? (
            <p className="text-zinc-600 text-sm text-center py-8">Noch keine Kreditkarten erfasst.</p>
          ) : (
            cards.map(card => (
              <div key={card.id}>
                {editingId === card.id ? (
                  <CardForm
                    initial={card}
                    onSave={data => updateCard(card.id, data)}
                    onCancel={() => setEditingId(null)} />
                ) : (
                  <div className="bg-zinc-900 rounded-2xl px-4 py-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ backgroundColor: card.color + "30" }}>
                      {card.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">{card.name}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        {card.ownerName && <span>{card.ownerName} · </span>}
                        fällig am {card.dueDay ?? 15}. des Monats
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditingId(card.id)} className="text-zinc-600 hover:text-white p-2 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteCard(card.id)} className="text-zinc-600 hover:text-red-400 p-2 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {showForm && (
            <CardForm onSave={createCard} onCancel={() => setShowForm(false)} />
          )}

          {!showForm && !editingId && (
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-zinc-500 rounded-2xl py-4 text-sm font-bold hover:text-white transition-colors active:bg-zinc-800">
              <Plus className="w-4 h-4" />
              Kreditkarte hinzufügen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
