"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"

type Category = { id: string; name: string; icon: string; type: string }

export default function NewTransactionPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [type, setType] = useState<"expense" | "income">("expense")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(data => {
      setCategories(data)
      const firstExpense = data.find((c: Category) => c.type === "expense")
      if (firstExpense) setCategoryId(firstExpense.id)
    })
  }, [])

  const filtered = categories.filter(c => c.type === type)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !categoryId || !date) return
    setLoading(true)
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(amount), categoryId, description, date }),
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
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t)
                const first = categories.find(c => c.type === t)
                if (first) setCategoryId(first.id)
              }}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                type === t
                  ? t === "expense"
                    ? "bg-white text-red-500 shadow-sm"
                    : "bg-white text-green-600 shadow-sm"
                  : "text-gray-400"
              }`}
            >
              {t === "expense" ? "Ausgabe" : "Einnahme"}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="block text-xs font-medium text-gray-400 mb-1">Betrag (CHF)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full text-3xl font-bold text-gray-900 focus:outline-none placeholder-gray-200"
            />
          </div>
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="block text-xs font-medium text-gray-400 mb-1">Datum</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full text-sm text-gray-900 focus:outline-none"
            />
          </div>
          <div className="px-4 py-3">
            <label className="block text-xs font-medium text-gray-400 mb-1">Beschreibung (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="z.B. Migros Einkauf"
              className="w-full text-sm text-gray-900 focus:outline-none placeholder-gray-300"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Kategorie</p>
          <div className="grid grid-cols-3 gap-2">
            {filtered.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                className={`bg-white rounded-2xl p-3 text-center shadow-sm border-2 transition-all ${
                  categoryId === cat.id ? "border-green-500" : "border-transparent"
                }`}
              >
                <div className="text-2xl">{cat.icon}</div>
                <div className="text-xs font-medium text-gray-700 mt-1 leading-tight">{cat.name}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !amount || !categoryId}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl py-4 font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-green-200 active:scale-[0.98] transition-transform"
        >
          <Check className="w-5 h-5" />
          {loading ? "Speichern…" : "Buchung speichern"}
        </button>
      </form>
    </div>
  )
}
