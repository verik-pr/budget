"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from "lucide-react"
import { useConfirm } from "@/components/confirm-sheet"
import { useToast } from "@/components/toast"
import { SkeletonList } from "@/components/skeleton"

type Category = { id: string; name: string; icon: string; type: string }

export default function KategorienPage() {
  const router = useRouter()
  const confirm = useConfirm()
  const toast = useToast()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newType, setNewType] = useState<"expense" | "income">("expense")
  const [newIcon, setNewIcon] = useState("🧾")
  const [newName, setNewName] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editIcon, setEditIcon] = useState("")
  const [editName, setEditName] = useState("")

  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then((data: Category[]) => { setCategories(data); setLoading(false) })
      .catch(() => { toast("Konnte Kategorien nicht laden", "error"); setLoading(false) })
  }, [toast])

  async function createCategory() {
    if (!newName.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), icon: newIcon.trim() || "📦", type: newType }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error)
      }
      const cat = await res.json()
      setCategories(cs => [...cs, cat].sort((a, b) => a.name.localeCompare(b.name, "de")))
      setNewName("")
      setNewIcon("🧾")
      setShowForm(false)
      toast(`Kategorie «${cat.name}» angelegt`)
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Konnte nicht speichern", "error")
    } finally {
      setSaving(false)
    }
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id)
    setEditIcon(cat.icon)
    setEditName(cat.name)
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), icon: editIcon.trim() || "📦" }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error)
      }
      const updated = await res.json()
      setCategories(cs => cs.map(c => c.id === id ? { ...c, name: updated.name, icon: updated.icon } : c))
      setEditingId(null)
      toast("Kategorie aktualisiert")
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Konnte nicht speichern", "error")
    }
  }

  async function deleteCategory(cat: Category) {
    const ok = await confirm({ title: `«${cat.name}» löschen?`, confirmLabel: "Löschen", destructive: true })
    if (!ok) return
    try {
      const res = await fetch(`/api/categories/${cat.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error)
      }
      setCategories(cs => cs.filter(c => c.id !== cat.id))
      toast("Kategorie gelöscht")
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Konnte nicht löschen", "error")
    }
  }

  const groups = [
    { type: "expense", label: "Ausgaben" },
    { type: "income", label: "Einnahmen" },
  ] as const

  return (
    <div className="max-w-lg mx-auto">
      <div className="ink-panel px-6 pt-safe pb-4 rounded-b-[28px]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="text-cream/50 hover:text-cream transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="kicker text-cream/45 flex-1">Kategorien</p>
          <button onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1 text-xs font-bold text-[#7fc89e] active:opacity-70">
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? "Abbrechen" : "Neu"}
          </button>
        </div>
      </div>

      <div className="stagger px-6 pt-5 pb-8 space-y-6">
        {showForm && (
          <div className="bg-card border border-rule shadow-card rounded-2xl p-4 space-y-3">
            <div className="flex gap-2">
              {(["expense", "income"] as const).map(t => (
                <button key={t} type="button" onClick={() => setNewType(t)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                    newType === t
                      ? t === "expense" ? "bg-ink text-cream" : "bg-pine text-cream"
                      : "bg-paper border border-rule text-muted"
                  }`}>
                  {t === "expense" ? "Ausgabe" : "Einnahme"}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newIcon} onChange={e => setNewIcon(e.target.value)} maxLength={4}
                className="w-14 bg-paper border border-rule rounded-xl px-3 py-2 text-xl text-center focus:outline-none focus:border-pine/50" />
              <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={40}
                placeholder="Name (z.B. Haushalt)"
                className="flex-1 bg-paper border border-rule rounded-xl px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-pine/50" />
            </div>
            <button onClick={createCategory} disabled={!newName.trim() || saving}
              className="w-full bg-pine text-cream rounded-xl py-2.5 text-sm font-bold disabled:opacity-30 active:scale-[0.98] transition-all">
              {saving ? "Speichern…" : "Kategorie anlegen"}
            </button>
          </div>
        )}

        {loading ? (
          <SkeletonList count={6} />
        ) : (
          groups.map(group => {
            const cats = categories.filter(c => c.type === group.type)
            if (cats.length === 0) return null
            return (
              <div key={group.type}>
                <p className="kicker text-muted mb-3">{group.label}</p>
                <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
                  {cats.map((cat, i) => (
                    <div key={cat.id} className={i < cats.length - 1 ? "border-b border-rule/60" : ""}>
                      {editingId === cat.id ? (
                        <div className="flex items-center gap-2 px-4 py-3">
                          <input value={editIcon} onChange={e => setEditIcon(e.target.value)} maxLength={4}
                            className="w-12 bg-paper border border-rule rounded-xl px-2 py-2 text-lg text-center focus:outline-none focus:border-pine/50" />
                          <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={40}
                            className="flex-1 min-w-0 bg-paper border border-rule rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-pine/50" />
                          <button onClick={() => saveEdit(cat.id)} className="text-pine p-1.5">
                            <Check className="w-4 h-4" strokeWidth={3} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-faint p-1.5">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 px-5 py-3.5">
                          <span className="text-xl w-7 text-center flex-shrink-0">{cat.icon}</span>
                          <p className="text-sm font-semibold text-ink flex-1 truncate">{cat.name}</p>
                          <button onClick={() => startEdit(cat)} className="text-faint hover:text-pine p-1">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteCategory(cat)} className="text-faint hover:text-blood p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}

        <p className="text-faint text-xs italic font-serif">
          Neue Kategorien stehen sofort beim Buchen, Scannen und in den Budgets zur Verfügung.
          Löschen geht nur, solange keine Buchungen oder Regeln daran hängen.
        </p>
      </div>
    </div>
  )
}
