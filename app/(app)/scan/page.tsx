"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Camera, Check, Loader2, ScanLine, X, FileText, Receipt, ChevronDown, ChevronUp } from "lucide-react"
import { CONTRIBUTORS } from "@/lib/utils"

type ScannedItem = {
  name: string
  amount: number
  category: string
  categoryId: string
  categoryName: string
  excluded: boolean
  contributor: string
  sharedWith: string | null
  sharedRatio: number | null
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

export default function ScanPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const fileRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<"capture" | "scanning" | "review">("capture")
  const [result, setResult] = useState<ScanResult | null>(null)
  const [items, setItems] = useState<ScannedItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accountId, setAccountId] = useState("")
  const [accounts, setAccounts] = useState<{ id: string; name: string; icon: string; color: string }[]>([])
  const [note, setNote] = useState("")
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saveError, setSaveError] = useState("")

  const firstName = session?.user?.name?.split(" ")[0]?.toLowerCase() ?? ""
  const myContrib = CONTRIBUTORS.find(c => c.label.toLowerCase().startsWith(firstName)) ?? CONTRIBUTORS[0]
  const partner = CONTRIBUTORS.find(c =>
    (myContrib.value === "erik" && c.value === "celine") ||
    (myContrib.value === "celine" && c.value === "erik")
  ) ?? CONTRIBUTORS[1]

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhase("scanning")
    setError("")
    setNote("")
    setExpanded(false)

    const [scanRes, catRes, accRes] = await Promise.all([
      (async () => { const fd = new FormData(); fd.append("file", file); return fetch("/api/scan-receipt", { method: "POST", body: fd }) })(),
      fetch("/api/categories"),
      fetch("/api/accounts?mine=true"),
    ])

    const [cats, { accounts: accs, defaultId }] = await Promise.all([catRes.json(), accRes.json()])
    setCategories(cats)
    setAccounts(accs)
    if (defaultId) setAccountId(defaultId)

    if (!scanRes.ok) {
      const err = await scanRes.json()
      setError(err.error || "Fehler beim Scannen")
      setPhase("capture")
      return
    }

    const data: ScanResult = await scanRes.json()
    setResult(data)
    setItems(data.items.map(item => ({ ...item, excluded: false, contributor: "", sharedWith: null, sharedRatio: null })))
    setPhase("review")
  }

  function triggerCapture() { fileRef.current?.setAttribute("capture", "environment"); fileRef.current?.click() }
  function triggerGallery() { fileRef.current?.removeAttribute("capture"); fileRef.current?.click() }
  function toggleItem(i: number) { setItems(prev => prev.map((item, j) => j === i ? { ...item, excluded: !item.excluded } : item)) }
  function updateCategory(i: number, categoryId: string) { setItems(prev => prev.map((item, j) => j === i ? { ...item, categoryId } : item)) }

  function setSplit(i: number, mode: "solo" | "half" | "full") {
    setItems(prev => prev.map((item, j) => j !== i ? item : {
      ...item,
      contributor: mode === "solo" ? "" : myContrib.value,
      sharedWith: mode === "solo" ? null : partner.value,
      sharedRatio: mode === "solo" ? null : mode === "half" ? 0.5 : 1.0,
    }))
  }

  function getSplitMode(item: ScannedItem): "solo" | "half" | "full" {
    if (!item.sharedWith) return "solo"
    return item.sharedRatio === 0.5 ? "half" : "full"
  }

  async function handleSave() {
    const toSave = items.filter(i => !i.excluded)
    if (toSave.length === 0) return
    setSaving(true)
    setSaveError("")

    try {
      const responses = await Promise.all(toSave.map(item =>
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
            note: note || null,
            ...(item.sharedWith ? { sharedWith: item.sharedWith, sharedRatio: item.sharedRatio } : {}),
          }),
        })
      ))
      const failed = responses.find(r => !r.ok)
      if (failed) {
        const err = await failed.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${failed.status}`)
      }
      router.push("/dashboard")
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Fehler beim Speichern")
      setSaving(false)
    }
  }

  const activeItems = items.filter(i => !i.excluded)
  const activeTotal = activeItems.reduce((s, i) => s + i.amount, 0)
  const isInvoice = result?.documentType === "invoice"

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-black">
      <div className="px-6 pt-safe pb-24">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          <p className="text-zinc-500 text-xs font-semibold tracking-widest uppercase">
            {phase === "review" ? (isInvoice ? "Rechnung" : "Quittung") : "Dokument scannen"}
          </p>
        </div>

        {/* Capture */}
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
            <button onClick={triggerCapture} className="bg-green-500 text-black font-black px-8 py-4 rounded-2xl flex items-center gap-2 active:scale-95 transition-all">
              <Camera className="w-5 h-5" />Foto aufnehmen
            </button>
            <button onClick={triggerGallery} className="text-zinc-500 text-sm font-semibold">Aus Galerie wählen</button>
          </div>
        )}

        {/* Scanning */}
        {phase === "scanning" && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
            <p className="text-white font-bold">KI liest Dokument…</p>
            <p className="text-zinc-500 text-sm">Einen Moment bitte</p>
          </div>
        )}

        {/* Review */}
        {phase === "review" && result && (
          <div className="space-y-4">

            {/* Main card — collapsed by default */}
            <div className="bg-zinc-900 rounded-3xl overflow-hidden">

              {/* Header row — always visible */}
              <button
                className="w-full flex items-center gap-4 px-5 py-4 active:bg-zinc-800 transition-colors"
                onClick={() => setExpanded(e => !e)}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: isInvoice ? "#1e3a5f" : "#14532d" }}>
                  {isInvoice
                    ? <FileText className="w-5 h-5 text-blue-400" />
                    : <Receipt className="w-5 h-5 text-green-400" />}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-bold text-base">{result.merchant}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {result.date}
                    {result.dueDate && <span className="text-orange-400 ml-2">· fällig {result.dueDate}</span>}
                    {result.reference && <span className="text-zinc-600 ml-2">· {result.reference}</span>}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-bold tabular-nums">CHF {activeTotal.toFixed(2)}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{activeItems.length} Posten</p>
                </div>
                <div className="ml-1 text-zinc-500">
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {/* Expandable items */}
              {expanded && (
                <div className="border-t border-zinc-800">
                  {items.map((item, i) => {
                    const mode = getSplitMode(item)
                    return (
                      <div key={i} className={`border-b border-zinc-800 last:border-b-0 ${item.excluded ? "opacity-40" : ""}`}>

                        {/* Item row */}
                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-zinc-800 transition-colors"
                          onClick={() => toggleItem(i)}>
                          <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${item.excluded ? "border-zinc-600" : "border-green-500 bg-green-500"}`}>
                            {!item.excluded && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                          </div>
                          <p className={`flex-1 text-sm font-semibold ${item.excluded ? "line-through text-zinc-600" : "text-white"}`}>{item.name}</p>
                          <p className={`text-sm font-bold tabular-nums ${item.excluded ? "text-zinc-700" : "text-white"}`}>CHF {item.amount.toFixed(2)}</p>
                        </div>

                        {!item.excluded && (
                          <div className="px-4 pb-3 space-y-2">
                            {/* Category */}
                            <select
                              value={item.categoryId}
                              onChange={e => updateCategory(i, e.target.value)}
                              className="w-full bg-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none">
                              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                            </select>

                            {/* Split */}
                            <div className="flex gap-2">
                              {([
                                { mode: "solo" as const, label: "Nur ich" },
                                { mode: "half" as const, label: "50/50" },
                                { mode: "full" as const, label: `Nur ${partner.label.split(" ")[0]}` },
                              ]).map(opt => (
                                <button key={opt.mode} type="button"
                                  onClick={() => setSplit(i, opt.mode)}
                                  style={mode === opt.mode && opt.mode !== "solo" ? { backgroundColor: partner.color } : {}}
                                  className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all flex-1 ${
                                    mode === opt.mode
                                      ? opt.mode === "solo" ? "bg-zinc-600 text-white" : "text-white"
                                      : "bg-zinc-800 text-zinc-500"
                                  }`}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>

                            {item.sharedWith && (
                              <p className="text-xs text-zinc-500 text-right">
                                {partner.label.split(" ")[0]} schuldet <span className="font-bold" style={{ color: partner.color }}>CHF {(item.amount * (item.sharedRatio ?? 0)).toFixed(2)}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Account */}
            {accounts.length > 1 && (
              <div>
                <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-2">Konto</p>
                <div className="flex gap-2 flex-wrap">
                  {accounts.map(acc => (
                    <button key={acc.id} type="button"
                      onClick={() => setAccountId(accountId === acc.id ? "" : acc.id)}
                      style={accountId === acc.id ? { backgroundColor: acc.color } : {}}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${accountId === acc.id ? "text-white" : "bg-zinc-900 text-zinc-400"}`}>
                      <span>{acc.icon}</span><span>{acc.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            <div>
              <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-2">Notiz</p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="z.B. Grosseinkauf vor den Ferien…"
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600 resize-none" />
            </div>

          </div>
        )}
      </div>

      {/* Save bar */}
      {phase === "review" && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 px-6 py-4 safe-bottom">
          {saveError && <p className="text-red-400 text-xs text-center mb-2">{saveError}</p>}
          <div className="max-w-lg mx-auto flex items-center gap-4">
            <div className="flex-1">
              <p className="text-white font-bold tabular-nums">CHF {activeTotal.toFixed(2)}</p>
              <p className="text-zinc-500 text-xs">{activeItems.length} Posten · tippe Karte zum Prüfen</p>
            </div>
            <button onClick={handleSave} disabled={saving || activeItems.length === 0}
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
