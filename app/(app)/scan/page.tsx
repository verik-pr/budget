"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Check, Loader2, ScanLine, X, FileText, Receipt } from "lucide-react"
import { CONTRIBUTORS } from "@/lib/utils"

type ScannedItem = {
  name: string
  amount: number
  category: string
  categoryId: string
  categoryName: string
  excluded: boolean
  contributor: string
}

type ScanResult = {
  documentType: string
  merchant: string
  date: string
  dueDate: string | null
  reference: string | null
  items: ScannedItem[]
}

type Category = { id: string; name: string; icon: string; type: string }

const PEOPLE = [
  { value: "", label: "Ich" },
  ...CONTRIBUTORS.map(c => ({ value: c.value, label: c.label.split(" ")[0] })),
]

export default function ScanPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<"capture" | "scanning" | "review">("capture")
  const [result, setResult] = useState<ScanResult | null>(null)
  const [items, setItems] = useState<ScannedItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accountId, setAccountId] = useState("")
  const [accounts, setAccounts] = useState<{ id: string; name: string; icon: string; color: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPhase("scanning")
    setError("")

    const [scanRes, catRes, accRes] = await Promise.all([
      (async () => {
        const fd = new FormData()
        fd.append("file", file)
        return fetch("/api/scan-receipt", { method: "POST", body: fd })
      })(),
      fetch("/api/categories"),
      fetch("/api/accounts"),
    ])

    const [cats, accs]: [Category[], { id: string; name: string; icon: string; color: string }[]] = await Promise.all([catRes.json(), accRes.json()])
    setCategories(cats)
    setAccounts(accs)

    if (!scanRes.ok) {
      const err = await scanRes.json()
      setError(err.error || "Fehler beim Scannen")
      setPhase("capture")
      return
    }

    const data: ScanResult = await scanRes.json()
    const mappedItems: ScannedItem[] = data.items.map(item => ({ ...item, excluded: false, contributor: "" }))
    setResult(data)
    setItems(mappedItems)
    setPhase("review")
  }

  function triggerCapture() {
    if (fileRef.current) {
      fileRef.current.setAttribute("capture", "environment")
      fileRef.current.click()
    }
  }

  function triggerGallery() {
    if (fileRef.current) {
      fileRef.current.removeAttribute("capture")
      fileRef.current.click()
    }
  }

  function toggleItem(index: number) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, excluded: !item.excluded } : item))
  }

  function updateCategory(index: number, categoryId: string) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, categoryId } : item))
  }

  function updateContributor(index: number, contributor: string) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, contributor } : item))
  }

  async function handleSave() {
    const toSave = items.filter(i => !i.excluded)
    if (toSave.length === 0) return
    setSaving(true)

    await Promise.all(toSave.map(item =>
      fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: item.amount,
          categoryId: item.categoryId,
          description: item.name,
          date: result?.date ?? new Date().toISOString().split("T")[0],
          contributor: item.contributor || null,
          accountId: accountId || null,
        }),
      })
    ))

    router.push("/dashboard")
    router.refresh()
  }

  const activeCount = items.filter(i => !i.excluded).length
  const activeTotal = items.filter(i => !i.excluded).reduce((s, i) => s + i.amount, 0)
  const isInvoice = result?.documentType === "invoice"

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-black">
      <div className="px-6 pt-safe pb-24">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div>
            <p className="text-zinc-500 text-xs font-semibold tracking-widest uppercase">
              {isInvoice ? "Rechnung" : "Quittung scannen"}
            </p>
            {result && (
              <div className="flex items-center gap-2 mt-0.5">
                {isInvoice
                  ? <FileText className="w-3.5 h-3.5 text-blue-400" />
                  : <Receipt className="w-3.5 h-3.5 text-green-400" />
                }
                <p className="text-white text-sm font-bold">
                  {result.merchant} · {result.date}
                  {result.dueDate && <span className="text-orange-400 ml-2">fällig {result.dueDate}</span>}
                </p>
              </div>
            )}
            {result?.reference && (
              <p className="text-zinc-600 text-xs mt-0.5">Ref: {result.reference}</p>
            )}
          </div>
        </div>

        {/* Capture phase */}
        {phase === "capture" && (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center">
              <ScanLine className="w-10 h-10 text-green-500" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">Dokument scannen</p>
              <p className="text-zinc-500 text-sm mt-1">Quittungen, Rechnungen, Belege</p>
            </div>
            {error && <p className="text-red-400 text-sm text-center bg-red-950/30 rounded-xl px-4 py-3">{error}</p>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button
              onClick={triggerCapture}
              className="bg-green-500 text-black font-black px-8 py-4 rounded-2xl flex items-center gap-2 active:scale-95 transition-all">
              <Camera className="w-5 h-5" />
              Foto aufnehmen
            </button>
            <button onClick={triggerGallery} className="text-zinc-500 text-sm font-semibold">
              Aus Galerie wählen
            </button>
          </div>
        )}

        {/* Scanning phase */}
        {phase === "scanning" && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
            <p className="text-white font-bold">KI liest Dokument…</p>
            <p className="text-zinc-500 text-sm">Einen Moment bitte</p>
          </div>
        )}

        {/* Review phase */}
        {phase === "review" && (
          <div className="space-y-6">

            {/* Invoice info banner */}
            {isInvoice && (
              <div className="bg-blue-950/40 border border-blue-900/50 rounded-2xl px-4 py-3 flex items-start gap-3">
                <FileText className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-blue-300 text-sm font-semibold">Rechnung erkannt</p>
                  {result?.dueDate && (
                    <p className="text-blue-400/70 text-xs mt-0.5">Zahlungsfrist: <span className="text-orange-400 font-semibold">{result.dueDate}</span></p>
                  )}
                  {result?.reference && (
                    <p className="text-blue-400/70 text-xs">Referenz: {result.reference}</p>
                  )}
                </div>
              </div>
            )}

            {/* Konto */}
            {accounts.length > 0 && (
              <div>
                <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-3">Konto</p>
                <div className="flex gap-2 flex-wrap">
                  {accounts.map(acc => (
                    <button key={acc.id} type="button"
                      onClick={() => setAccountId(accountId === acc.id ? "" : acc.id)}
                      style={accountId === acc.id ? { backgroundColor: acc.color } : {}}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${accountId === acc.id ? "text-white" : "bg-zinc-900 text-zinc-400"}`}>
                      <span>{acc.icon}</span>
                      <span>{acc.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Items */}
            <div>
              <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-3">
                Posten — tippe zum Ausschliessen
              </p>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className={`rounded-2xl overflow-hidden transition-all ${item.excluded ? "opacity-30" : ""}`}>

                    {/* Name + Betrag */}
                    <div
                      className="flex items-center gap-3 bg-zinc-900 px-4 py-3 cursor-pointer active:bg-zinc-800"
                      onClick={() => toggleItem(i)}>
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${item.excluded ? "border-zinc-700" : "border-green-500 bg-green-500"}`}>
                        {!item.excluded && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                      </div>
                      <p className={`flex-1 text-sm font-semibold ${item.excluded ? "line-through text-zinc-600" : "text-white"}`}>
                        {item.name}
                      </p>
                      <p className={`text-sm font-bold tabular-nums ${item.excluded ? "text-zinc-700" : "text-white"}`}>
                        CHF {item.amount.toFixed(2)}
                      </p>
                    </div>

                    {!item.excluded && (
                      <>
                        {/* Kategorie */}
                        <select
                          value={item.categoryId}
                          onChange={e => updateCategory(i, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="w-full bg-zinc-800 border-t border-zinc-700 px-4 py-2.5 text-xs text-zinc-400 focus:outline-none">
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                          ))}
                        </select>

                        {/* Wer */}
                        <div className="bg-zinc-800 border-t border-zinc-700 px-4 py-2.5 flex gap-2 flex-wrap">
                          {PEOPLE.map(p => {
                            const contrib = CONTRIBUTORS.find(c => c.value === p.value)
                            const isActive = item.contributor === p.value
                            return (
                              <button
                                key={p.value}
                                type="button"
                                onClick={e => { e.stopPropagation(); updateContributor(i, p.value) }}
                                style={isActive && contrib ? { backgroundColor: contrib.color } : isActive ? { backgroundColor: "#6366f1" } : {}}
                                className={`text-xs px-3 py-1 rounded-full font-bold transition-all ${isActive ? "text-white" : "bg-zinc-700 text-zinc-400"}`}>
                                {p.label}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save bar */}
      {phase === "review" && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 px-6 py-4 safe-bottom">
          <div className="max-w-lg mx-auto flex items-center gap-4">
            <div className="flex-1">
              <p className="text-white font-bold tabular-nums">CHF {activeTotal.toFixed(2)}</p>
              <p className="text-zinc-500 text-xs">{activeCount} {activeCount === 1 ? "Posten" : "Posten"} ausgewählt</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || activeCount === 0}
              className="bg-green-500 text-black font-black px-6 py-3 rounded-2xl flex items-center gap-2 disabled:opacity-30 active:scale-95 transition-all">
              <Check className="w-4 h-4" strokeWidth={3} />
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
