"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Camera, X, Check, ScanLine } from "lucide-react"
import Link from "next/link"
import { CONTRIBUTORS } from "@/lib/utils"

type Category = { id: string; name: string; icon: string; type: string }

export default function NewTransactionPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [type, setType] = useState<"expense" | "income">("expense")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [contributor, setContributor] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(data => {
      setCategories(data)
      const first = data.find((c: Category) => c.type === "expense")
      if (first) setCategoryId(first.id)
    })
  }, [])

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const filtered = categories.filter(c => c.type === type)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !categoryId || !date) return
    setLoading(true)

    let photoPath: string | null = null
    if (photoFile) {
      const fd = new FormData()
      fd.append("file", photoFile)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      photoPath = data.filename
    }

    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(amount), categoryId, description, date, photoPath, contributor: contributor || null }),
    })
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-black">
      <div className="px-6 pt-safe pb-6">
        <p className="text-zinc-500 text-xs font-semibold tracking-widest uppercase mb-6">Neue Buchung</p>

        {/* Scan shortcut */}
        <Link href="/scan"
          className="flex items-center gap-3 bg-zinc-900 rounded-2xl px-4 py-3 mb-8 active:bg-zinc-800 transition-colors">
          <div className="w-9 h-9 bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <ScanLine className="w-5 h-5 text-green-500" />
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-bold">Quittung scannen</p>
            <p className="text-zinc-500 text-xs">KI erkennt Posten automatisch</p>
          </div>
          <span className="text-zinc-600 text-lg">›</span>
        </Link>

        {/* Type toggle */}
        <div className="flex gap-3 mb-8">
          {(["expense", "income"] as const).map(t => (
            <button key={t} type="button"
              onClick={() => {
                setType(t)
                const first = categories.find(c => c.type === t)
                if (first) setCategoryId(first.id)
              }}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
                type === t
                  ? t === "expense" ? "bg-white text-black" : "bg-green-500 text-black"
                  : "bg-zinc-900 text-zinc-500"
              }`}>
              {t === "expense" ? "Ausgabe" : "Einnahme"}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div className="mb-8">
          <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-2">Betrag CHF</p>
          <input type="number" step="0.01" min="0.01" required value={amount}
            onChange={e => setAmount(e.target.value)} placeholder="0.00"
            className="w-full bg-transparent text-white text-5xl font-black focus:outline-none placeholder-zinc-800 tabular-nums" />
          <div className="h-px bg-zinc-800 mt-3" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Details */}
          <div className="space-y-4">
            <div>
              <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-2">Datum</p>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zinc-600" />
            </div>
            <div>
              <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-2">Beschreibung</p>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="z.B. Migros Einkauf"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zinc-600 placeholder-zinc-700" />
            </div>
          </div>

          {/* Categories */}
          <div>
            <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-3">Kategorie</p>
            <div className="grid grid-cols-4 gap-2">
              {filtered.map(cat => (
                <button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)}
                  className={`rounded-2xl py-3 px-2 text-center transition-all ${
                    categoryId === cat.id ? "bg-white" : "bg-zinc-900"
                  }`}>
                  <div className="text-xl mb-1">{cat.icon}</div>
                  <div className={`text-[10px] font-semibold leading-tight ${categoryId === cat.id ? "text-black" : "text-zinc-500"}`}>
                    {cat.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Von wem */}
          <div>
            <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-3">Von wem</p>
            <div className="grid grid-cols-2 gap-2">
              {CONTRIBUTORS.map(c => (
                <button key={c.value} type="button"
                  onClick={() => setContributor(contributor === c.value ? "" : c.value)}
                  style={contributor === c.value ? { backgroundColor: c.color } : {}}
                  className={`rounded-2xl py-3 px-3 text-sm font-bold transition-all text-left ${
                    contributor === c.value ? "text-white" : "bg-zinc-900 text-zinc-400"
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-zinc-700 text-xs mt-2">Leer lassen = du selbst</p>
          </div>

          {/* Photo */}
          <div>
            <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-3">Quittung</p>
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              onChange={handlePhoto} className="hidden" />
            {photoPreview ? (
              <div className="relative rounded-2xl overflow-hidden">
                <img src={photoPreview} className="w-full h-40 object-cover" alt="Vorschau" />
                <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                  className="absolute top-3 right-3 bg-black/60 rounded-full p-1.5">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl py-5 flex flex-col items-center gap-2 text-zinc-600 hover:border-zinc-600 transition-colors">
                <Camera className="w-5 h-5" />
                <span className="text-xs font-medium">Foto hinzufügen</span>
              </button>
            )}
          </div>

          <button type="submit" disabled={loading || !amount || !categoryId}
            className="w-full bg-green-500 hover:bg-green-400 text-black rounded-2xl py-4 font-black text-sm disabled:opacity-30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
            <Check className="w-4 h-4" />
            {loading ? "Speichern…" : "Buchung speichern"}
          </button>
        </form>
      </div>
    </div>
  )
}
