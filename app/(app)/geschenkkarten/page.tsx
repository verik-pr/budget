"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Trash2, Pencil, Check } from "lucide-react"
import { formatCHF, parseAmount } from "@/lib/utils"
import { useConfirm } from "@/components/confirm-sheet"
import { SkeletonList } from "@/components/skeleton"
import { useToast } from "@/components/toast"

type GiftcardAccount = {
  id: string
  name: string
  icon: string
  color: string
  type: string
  giftcardFaceValue: number | null
  giftcardPrice: number | null
  giftcardRemaining?: number
}

const COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"
]

function CardForm({ initial, onSave, onCancel }: {
  initial?: Partial<GiftcardAccount>
  onSave: (data: { name: string; icon: string; color: string; type: string; giftcardFaceValue: number; giftcardPrice: number }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [icon, setIcon] = useState(initial?.icon ?? "🎁")
  const [color, setColor] = useState(initial?.color ?? "#f59e0b")
  const [faceValue, setFaceValue] = useState(initial?.giftcardFaceValue?.toString() ?? "")
  const [price, setPrice] = useState(initial?.giftcardPrice?.toString() ?? "")

  const parsedFace = parseAmount(faceValue)
  const parsedPrice = parseAmount(price)
  const valid = !!name && parsedFace !== null && parsedPrice !== null && parsedPrice <= parsedFace
  const discount = parsedFace && parsedPrice ? Math.round((1 - parsedPrice / parsedFace) * 100) : 0

  return (
    <div className="bg-card border border-rule shadow-card rounded-2xl p-4 space-y-4">
      <div className="flex gap-2">
        <input value={icon} onChange={e => setIcon(e.target.value)}
          className="w-14 bg-paper border border-rule rounded-xl px-3 py-2.5 text-xl text-center focus:outline-none focus:border-pine/50" />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. IKEA Geschenkkarte"
          className="flex-1 bg-paper border border-rule rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-pine/50" />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <p className="kicker text-muted mb-2">Guthaben CHF</p>
          <input type="text" inputMode="decimal" value={faceValue} onChange={e => setFaceValue(e.target.value)}
            placeholder="1000"
            className="w-full bg-paper border border-rule rounded-xl px-3 py-2.5 text-sm text-ink tabular-nums placeholder:text-faint focus:outline-none focus:border-pine/50" />
        </div>
        <div className="flex-1">
          <p className="kicker text-muted mb-2">Bezahlt CHF</p>
          <input type="text" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)}
            placeholder="900"
            className="w-full bg-paper border border-rule rounded-xl px-3 py-2.5 text-sm text-ink tabular-nums placeholder:text-faint focus:outline-none focus:border-pine/50" />
        </div>
      </div>
      <p className="text-faint text-xs italic font-serif -mt-2">
        {discount > 0
          ? `${discount}% Rabatt — Einkäufe mit der Karte werden automatisch günstiger gebucht.`
          : "Falls mit Rabatt gekauft: bezahlten Preis eintragen — Einkäufe werden dann automatisch günstiger gebucht."}
      </p>

      <div>
        <p className="kicker text-muted mb-2">Farbe</p>
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

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-paper border border-rule text-muted rounded-xl py-2.5 text-sm font-bold">Abbrechen</button>
        <button
          onClick={() => { if (valid) onSave({ name, icon, color, type: "giftcard", giftcardFaceValue: parsedFace!, giftcardPrice: parsedPrice! }) }}
          disabled={!valid}
          className="flex-1 bg-pine text-cream rounded-xl py-2.5 text-sm font-bold disabled:opacity-30">
          Speichern
        </button>
      </div>
    </div>
  )
}

export default function GeschenkkartenPage() {
  const router = useRouter()
  const confirm = useConfirm()
  const toast = useToast()
  const [cards, setCards] = useState<GiftcardAccount[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    fetch("/api/accounts")
      .then(r => r.json())
      .then((all: GiftcardAccount[]) => {
        setCards(all.filter(a => a.type === "giftcard"))
        setLoading(false)
      })
  }
  useEffect(load, [])

  async function createCard(data: object) {
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      setShowForm(false)
      toast("Geschenkkarte angelegt")
      load()
    } catch {
      toast("Konnte nicht speichern", "error")
    }
  }

  async function updateCard(id: string, data: object) {
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      setEditingId(null)
      toast("Geschenkkarte aktualisiert")
      load()
    } catch {
      toast("Konnte nicht speichern", "error")
    }
  }

  async function deleteCard(id: string) {
    const ok = await confirm({ title: "Geschenkkarte löschen?", confirmLabel: "Löschen", destructive: true })
    if (!ok) return
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" })
      if (res.status === 409) {
        toast("Karte hat Buchungen — zuerst Buchungen löschen oder umbuchen", "error")
        return
      }
      if (!res.ok) throw new Error()
      setCards(prev => prev.filter(c => c.id !== id))
      toast("Geschenkkarte gelöscht")
    } catch {
      toast("Konnte nicht gelöscht werden", "error")
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="ink-panel px-6 pt-safe pb-4 sticky top-0 z-10 rounded-b-[28px]">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-cream/50 hover:text-cream transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="kicker text-cream/45">Geschenkkarten</p>
        </div>
      </div>

      <div className="px-6 pt-4 pb-8">
        <p className="text-muted text-xs mb-4 italic font-serif">
          Der Kartenkauf zählt nicht als Ausgabe — erst die Einkäufe mit der Karte, automatisch zum effektiven Preis (mit Rabatt).
        </p>
        <div className="space-y-3">
          {loading ? (
            <SkeletonList count={2} />
          ) : cards.length === 0 && !showForm ? (
            <p className="text-muted text-sm text-center py-12">Noch keine Geschenkkarten erfasst.</p>
          ) : (
            cards.map(card => {
              const face = card.giftcardFaceValue ?? 0
              const remaining = card.giftcardRemaining ?? face
              const pct = face > 0 ? Math.max(0, Math.min(100, (remaining / face) * 100)) : 0
              const discount = face && card.giftcardPrice ? Math.round((1 - card.giftcardPrice / face) * 100) : 0
              return (
                <div key={card.id}>
                  {editingId === card.id ? (
                    <CardForm
                      initial={card}
                      onSave={data => updateCard(card.id, data)}
                      onCancel={() => setEditingId(null)} />
                  ) : (
                    <div className="bg-card border border-rule shadow-card rounded-2xl px-4 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ backgroundColor: card.color + "30" }}>
                          {card.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-ink font-bold text-sm">{card.name}</p>
                          <p className="text-muted text-xs mt-0.5">
                            Rest {formatCHF(remaining)} von {formatCHF(face)}
                            {discount > 0 && <span> · {discount}% Rabatt</span>}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setEditingId(card.id)} className="text-faint hover:text-pine p-2 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteCard(card.id)} className="text-faint hover:text-blood p-2 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="h-1.5 bg-paper rounded-full mt-3 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: card.color }} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}

          {showForm && (
            <CardForm onSave={createCard} onCancel={() => setShowForm(false)} />
          )}

          {!showForm && !editingId && (
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-card border border-dashed border-rule text-muted rounded-2xl py-4 text-sm font-bold hover:text-ink transition-colors active:bg-paper">
              <Plus className="w-4 h-4" />
              Geschenkkarte hinzufügen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
