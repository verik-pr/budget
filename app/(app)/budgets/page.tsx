"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { formatCHF } from "@/lib/utils"
import { SkeletonList } from "@/components/skeleton"

type Category = { id: string; name: string; icon: string; type: string; budget: number | null; spent: number }

function periodRange() {
  const now = new Date()
  const start = now.getDate() >= 24
    ? new Date(now.getFullYear(), now.getMonth(), 24)
    : new Date(now.getFullYear(), now.getMonth() - 1, 24)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 24)
  return { start, end }
}

export default function BudgetsPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { start, end } = periodRange()
    const params = new URLSearchParams({
      withSpent: "true",
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    })
    fetch(`/api/categories?${params}`).then(r => r.json()).then((data: Category[]) => {
      const expense = data.filter(c => c.type === "expense")
      setCategories(expense)
      setDrafts(Object.fromEntries(expense.map(c => [c.id, c.budget?.toString() ?? ""])))
      setLoading(false)
    })
  }, [])

  async function save(cat: Category) {
    const raw = drafts[cat.id]
    const newBudget = raw === "" ? null : parseFloat(raw)
    if (newBudget === cat.budget) return
    setSavingId(cat.id)
    const res = await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget: newBudget }),
    })
    const updated = await res.json()
    setCategories(cs => cs.map(c => c.id === cat.id ? { ...c, budget: updated.budget } : c))
    setSavingId(null)
  }

  const totalBudget = categories.reduce((s, c) => s + (c.budget ?? 0), 0)
  const totalSpent = categories.reduce((s, c) => s + (c.budget ? c.spent : 0), 0)

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-black px-6 pt-safe pb-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="text-zinc-500 text-xs font-semibold tracking-widest uppercase">Budgets</p>
        </div>
      </div>

      <div className="px-6 pt-4 pb-8 space-y-4">
        {loading ? (
          <SkeletonList count={6} />
        ) : (
          <>
            {totalBudget > 0 && (
              <div className="bg-zinc-900 rounded-2xl px-5 py-4">
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-2">Diese Periode</p>
                <div className="flex items-baseline justify-between">
                  <p className="text-white text-2xl font-black tabular-nums">{formatCHF(totalSpent)}</p>
                  <p className="text-zinc-500 text-sm tabular-nums">von {formatCHF(totalBudget)}</p>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-3">
                  <div className={`h-full rounded-full transition-all ${
                    totalSpent > totalBudget ? "bg-red-500" : totalSpent / totalBudget > 0.8 ? "bg-orange-400" : "bg-green-500"
                  }`}
                    style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }} />
                </div>
              </div>
            )}

            <p className="text-zinc-600 text-xs">Lass leer um kein Budget zu setzen.</p>

            <div className="bg-white rounded-3xl overflow-hidden">
              {categories.map((cat, i) => {
                const draft = drafts[cat.id] ?? ""
                const changed = (cat.budget?.toString() ?? "") !== draft
                const pct = cat.budget ? (cat.spent / cat.budget) * 100 : 0
                const over = pct > 100
                const near = pct > 80 && pct <= 100
                return (
                  <div key={cat.id} className={`px-5 py-4 ${i < categories.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl w-7 text-center">{cat.icon}</span>
                      <p className="text-sm font-semibold text-gray-900 flex-1">{cat.name}</p>
                      <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-3 py-1.5">
                        <input type="text" inputMode="decimal"
                          value={draft}
                          onChange={e => setDrafts(d => ({ ...d, [cat.id]: e.target.value }))}
                          onBlur={() => save(cat)}
                          placeholder="—"
                          className="w-16 bg-transparent text-sm text-gray-900 text-right tabular-nums focus:outline-none placeholder-gray-300" />
                        <span className="text-xs text-gray-400">CHF</span>
                      </div>
                    </div>
                    {cat.budget && (
                      <>
                        <div className="flex justify-between text-xs mb-1">
                          <p className="tabular-nums text-gray-500">
                            {formatCHF(cat.spent)} / {formatCHF(cat.budget)}
                          </p>
                          <p className={`tabular-nums font-semibold ${over ? "text-red-500" : near ? "text-orange-500" : "text-gray-400"}`}>
                            {pct.toFixed(0)}%
                          </p>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${
                            over ? "bg-red-500" : near ? "bg-orange-400" : "bg-gray-900"
                          }`}
                            style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </>
                    )}
                    {changed && savingId === cat.id && (
                      <p className="text-xs text-zinc-400 mt-1">Speichern…</p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
