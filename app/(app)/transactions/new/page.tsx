"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Check, Camera, X } from "lucide-react"

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
      body: JSON.stringify({ amount: parseFloat(amount), categoryId, description, date, photoPath }),
    })
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white border-b border-gray-100 px-4 pt-14 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Neue Buchung</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-5">
        <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-2xl">
          {(["expense", "income"] as const).map(t => (
            <button key={t} type="button"
              onClick={() => {
                setType(t)
                const first = categories.find(c => c.type === t)
                if (first) setCategoryId(first.id)
              }}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                type === t ? t === "expense" ? "bg-white text-red-500 shadow-sm" : "bg-white text-green-600 shadow-sm" : "text-gray-400"
              }`}>
              {t === "expense" ? "Ausgabe" : "Einnahme"}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="block text-xs font-medium text-gray-400 mb-1">Betrag (CHF)</label>
            <input type="number" step="0.01" min="0.01" required value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="0.00"
              className="w-full text-3xl font-bold text-gray-900 focus:outline-none placeholder-gray-200" />
          </div>
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="block text-xs font-medium text-gray-400 mb-1">Datum</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)}
              className="w-full text-sm text-gray-900 focus:outline-none" />
          </div>
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="block text-xs font-medium text-gray-400 mb-1">Beschreibung (optional)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="z.B. Migros Einkauf"
              className="w-full text-sm text-gray-900 focus:outline-none placeholder-gray-300" />
          </div>
          <div className="px-4 py-3">
            <label className="block text-xs font-medium text-gray-400 mb-2">Quittungsfoto (optional)</label>
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              onChange={handlePhoto} className="hidden" />
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} className="w-full h-40 object-cover rounded-xl" alt="Vorschau" />
                <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                  className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 flex flex-col items-center gap-1 text-gray-400 hover:border-green-400 hover:text-green-500 transition-colors">
                <Camera className="w-6 h-6" />
                <span className="text-xs">Foto aufnehmen oder auswählen</span>
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Kategorie</p>
          <div className="grid grid-cols-3 gap-2">
            {filtered.map(cat => (
              <button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)}
                className={`bg-white rounded-2xl p-3 text-center shadow-sm border-2 transition-all ${categoryId === cat.id ? "border-green-500" : "border-transparent"}`}>
                <div className="text-2xl">{cat.icon}</div>
                <div className="text-xs font-medium text-gray-700 mt-1 leading-tight">{cat.name}</div>
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading || !amount || !categoryId}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl py-4 font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-green-200 active:scale-[0.98] transition-transform">
          <Check className="w-5 h-5" />
          {loading ? "Speichern…" : "Buchung speichern"}
        </button>
      </form>
    </div>
  )
}
