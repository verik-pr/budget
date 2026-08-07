"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Camera, Check, Loader2, Pencil, ScanLine, X, FileText, Receipt } from "lucide-react"
import { CONTRIBUTORS, formatCHF, parseAmount, todayLocalISO } from "@/lib/utils"
import { useConfirm } from "@/components/confirm-sheet"

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
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<"capture" | "scanning" | "review">("capture")
  const [result, setResult] = useState<ScanResult | null>(null)
  const [items, setItems] = useState<ScannedItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accountId, setAccountId] = useState("")
  const [accounts, setAccounts] = useState<{ id: string; name: string; icon: string; color: string }[]>([])
  const [note, setNote] = useState("")
  const [date, setDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [savedCount, setSavedCount] = useState(0)
  const [lastSaved, setLastSaved] = useState<{ merchant: string; total: number } | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editName, setEditName] = useState("")
  const [editAmount, setEditAmount] = useState("")

  const firstName = session?.user?.name?.split(" ")[0]?.toLowerCase() ?? ""
  const myContrib = CONTRIBUTORS.find(c => c.label.toLowerCase().startsWith(firstName)) ?? CONTRIBUTORS[0]

  // Wer hat diese Quittung bezahlt? Bleibt zwischen Scans erhalten (Stapel-Erfassung)
  const [paidBy, setPaidBy] = useState(myContrib.value === "celine" ? "celine" : "erik")
  const payer = CONTRIBUTORS.find(c => c.value === paidBy) ?? CONTRIBUTORS[0]
  const partner = CONTRIBUTORS.find(c =>
    (payer.value === "erik" && c.value === "celine") ||
    (payer.value === "celine" && c.value === "erik")
  ) ?? CONTRIBUTORS[1]

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Input zurücksetzen, sonst feuert onChange nicht, wenn dieselbe Datei
    // nochmal gewählt wird (z.B. nach einem Scan-Fehler)
    e.target.value = ""
    if (!file) return
    setPhase("scanning")
    setError("")
    setNote("")

    try {
      const [scanRes, catRes, accRes] = await Promise.all([
        (async () => { const fd = new FormData(); fd.append("file", file); return fetch("/api/scan-receipt", { method: "POST", body: fd }) })(),
        fetch("/api/categories"),
        fetch("/api/accounts?mine=true"),
      ])

      if (!catRes.ok || !accRes.ok) throw new Error("Stammdaten konnten nicht geladen werden")

      const [cats, { accounts: accs, defaultId }] = await Promise.all([catRes.json(), accRes.json()])
      setCategories(cats)
      setAccounts(accs)
      // Konto-Wahl über den Scan-Loop hinweg behalten (Stapel-Erfassung)
      if (defaultId) setAccountId(prev => prev || defaultId)

      if (!scanRes.ok) {
        const err = await scanRes.json().catch(() => ({}))
        setError(err.error || "Fehler beim Scannen")
        setPhase("capture")
        return
      }

      const data: ScanResult = await scanRes.json()
      setResult(data)
      setItems(data.items.map(item => ({ ...item, excluded: false, contributor: "", sharedWith: null, sharedRatio: null })))
      setDate(/^\d{4}-\d{2}-\d{2}$/.test(data.date ?? "") ? data.date : todayLocalISO())
      setLastSaved(null)
      setPhase("review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Scannen")
      setPhase("capture")
    }
  }

  function triggerCapture() { fileRef.current?.setAttribute("capture", "environment"); fileRef.current?.click() }
  function triggerGallery() { fileRef.current?.removeAttribute("capture"); fileRef.current?.click() }
  function toggleItem(i: number) { setItems(prev => prev.map((item, j) => j === i ? { ...item, excluded: !item.excluded } : item)) }
  function updateCategory(i: number, categoryId: string) { setItems(prev => prev.map((item, j) => j === i ? { ...item, categoryId } : item)) }

  function splitFields(mode: "solo" | "half" | "full") {
    return {
      contributor: mode === "solo" ? "" : payer.value,
      sharedWith: mode === "solo" ? null : partner.value,
      sharedRatio: mode === "solo" ? null : mode === "half" ? 0.5 : 1.0,
    }
  }

  function setSplit(i: number, mode: "solo" | "half" | "full") {
    setItems(prev => prev.map((item, j) => j !== i ? item : { ...item, ...splitFields(mode) }))
  }

  // Alle Posten auf einmal: Nur Zahler / 50/50 / Für Partner
  function setAllSplits(mode: "solo" | "half" | "full") {
    setItems(prev => prev.map(item => ({ ...item, ...splitFields(mode) })))
  }

  function startItemEdit(i: number) {
    setEditingIndex(i)
    setEditName(items[i].name)
    setEditAmount(items[i].amount.toFixed(2))
  }

  function saveItemEdit(i: number) {
    const amount = parseAmount(editAmount)
    const name = editName.trim()
    if (!name || !amount) return
    setItems(prev => prev.map((item, j) => j === i ? { ...item, name, amount } : item))
    setEditingIndex(null)
  }

  function getSplitMode(item: ScannedItem): "solo" | "half" | "full" {
    if (!item.sharedWith) return "solo"
    return item.sharedRatio === 0.5 ? "half" : "full"
  }

  async function handleSave(force = false) {
    const toSave = items.filter(i => !i.excluded)
    if (toSave.length === 0) return
    setSaving(true)
    setSaveError("")

    try {
      const response = await fetch("/api/scan-receipt/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: date || todayLocalISO(),
          accountId: accountId || null,
          note: note || null,
          force,
          receiptMerchant: result?.merchant ?? null,
          items: toSave.map(item => ({
            amount: item.amount,
            categoryId: item.categoryId,
            description: item.name,
            contributor: payer.value,
            ...(item.sharedWith ? { sharedWith: partner.value, sharedRatio: item.sharedRatio } : {}),
          })),
        }),
      })
      if (response.status === 409) {
        const dup = await response.json().catch(() => ({}))
        setSaving(false)
        const ok = await confirm({
          title: "Schon erfasst?",
          description: `${dup.merchant ?? "Ein Beleg"} vom ${formatDateCH(date)} über ${formatCHF(dup.total ?? 0)} existiert bereits. Trotzdem speichern?`,
          confirmLabel: "Trotzdem speichern",
        })
        if (ok) await handleSave(true)
        return
      }
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${response.status}`)
      }
      // Erfolg: zurück zum Scannen für die nächste Quittung (Stapel-Erfassung)
      const total = toSave.reduce((s, i) => s + i.amount, 0)
      setLastSaved({ merchant: result?.merchant ?? "Beleg", total })
      setSavedCount(c => c + 1)
      setResult(null)
      setItems([])
      setNote("")
      setDate("")
      setSaving(false)
      setPhase("capture")
      window.scrollTo(0, 0)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Fehler beim Speichern")
      setSaving(false)
    }
  }

  function formatDateCH(d: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
    const [y, m, day] = d.split("-")
    return `${parseInt(day)}.${parseInt(m)}.${y}`
  }

  const activeItems = items.filter(i => !i.excluded)
  const activeTotal = activeItems.reduce((s, i) => s + i.amount, 0)
  const isInvoice = result?.documentType === "invoice"

  return (
    <div className="max-w-lg mx-auto min-h-screen ink-panel">
      <div className="px-6 pt-safe pb-24">

        <div className="flex items-center gap-3 mb-8">
          <button onClick={async () => {
            if (phase === "review" && items.some(i => !i.excluded)) {
              const ok = await confirm({ title: "Scan verwerfen?", description: "Die erkannten Posten gehen verloren.", confirmLabel: "Verwerfen", destructive: true })
              if (!ok) return
            }
            router.back()
          }} className="text-cream/50 hover:text-cream transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div>
            <p className="kicker text-cream/45">
              {isInvoice ? "Rechnung" : "Quittung scannen"}
            </p>
            {result && (
              <div className="flex items-center gap-2 mt-0.5">
                {isInvoice ? <FileText className="w-3.5 h-3.5 text-blue-400" /> : <Receipt className="w-3.5 h-3.5 text-[#7fc89e]" />}
                <p className="text-cream text-sm font-bold">
                  {result.merchant} · {result.date}
                  {result.dueDate && <span className="text-orange-400 ml-2">fällig {result.dueDate}</span>}
                </p>
              </div>
            )}
            {result?.reference && <p className="text-cream/35 text-xs mt-0.5">Ref: {result.reference}</p>}
          </div>
        </div>

        {phase === "capture" && (
          <div className={`flex flex-col items-center justify-center gap-6 ${lastSaved ? "py-10" : "py-20"}`}>
            {lastSaved && (
              <div className="w-full bg-[#7fc89e]/10 border border-[#7fc89e]/30 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#7fc89e] flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-ink" strokeWidth={3} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-cream text-sm font-bold truncate">{lastSaved.merchant} · {formatCHF(lastSaved.total)}</p>
                  <p className="text-cream/50 text-xs">{savedCount}. Quittung in dieser Sitzung erfasst</p>
                </div>
              </div>
            )}
            <div className="w-20 h-20 bg-cream/[0.07] border border-cream/15 rounded-3xl flex items-center justify-center">
              <ScanLine className="w-10 h-10 text-[#7fc89e]" />
            </div>
            <div className="text-center">
              <p className="display text-cream text-2xl">{lastSaved ? "Nächste Quittung" : "Dokument scannen"}</p>
              <p className="text-cream/45 text-sm mt-1">Quittungen, Rechnungen, Belege</p>
            </div>
            {error && <p className="text-[#e89890] text-sm text-center bg-blood/15 rounded-xl px-4 py-3">{error}</p>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button onClick={triggerCapture} className="bg-cream text-ink font-black px-8 py-4 rounded-2xl flex items-center gap-2 active:scale-95 transition-all">
              <Camera className="w-5 h-5" />Foto aufnehmen
            </button>
            <button onClick={triggerGallery} className="text-cream/50 text-sm font-semibold">Aus Galerie wählen</button>
            {lastSaved && (
              <button onClick={() => router.push("/dashboard")}
                className="text-[#7fc89e] text-sm font-bold border border-[#7fc89e]/30 rounded-2xl px-6 py-3 active:scale-95 transition-all">
                Fertig — zum Dashboard
              </button>
            )}
          </div>
        )}

        {phase === "scanning" && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-10 h-10 text-[#7fc89e] animate-spin" />
            <p className="display text-cream text-xl">KI liest Dokument…</p>
            <p className="text-cream/45 text-sm">Einen Moment bitte</p>
          </div>
        )}

        {phase === "review" && (
          <div className="space-y-6">

            {isInvoice && (
              <div className="bg-blue-950/40 border border-blue-900/50 rounded-2xl px-4 py-3 flex items-start gap-3">
                <FileText className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-blue-300 text-sm font-semibold">Rechnung erkannt</p>
                  {result?.dueDate && <p className="text-blue-400/70 text-xs mt-0.5">Zahlungsfrist: <span className="text-orange-400 font-semibold">{result.dueDate}</span></p>}
                  {result?.reference && <p className="text-blue-400/70 text-xs">Referenz: {result.reference}</p>}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <div className="flex-1">
                <p className="kicker text-cream/40 mb-3">Bezahlt von</p>
                <div className="flex gap-2">
                  {CONTRIBUTORS.filter(c => c.value === "erik" || c.value === "celine").map(c => (
                    <button key={c.value} type="button"
                      onClick={() => setPaidBy(c.value)}
                      style={paidBy === c.value ? { backgroundColor: c.color } : {}}
                      className={`flex-1 px-3 py-2.5 rounded-2xl text-sm font-bold transition-all ${paidBy === c.value ? "text-cream shadow-md" : "bg-cream/10 text-cream/55 border border-cream/15"}`}>
                      {c.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="kicker text-cream/40 mb-3">Datum</p>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="bg-cream/10 border border-cream/15 rounded-2xl px-3 py-2.5 text-sm font-bold text-cream focus:outline-none focus:border-cream/40 [color-scheme:dark]" />
              </div>
            </div>

            {accounts.length > 1 && (
              <div>
                <p className="kicker text-cream/40 mb-3">Konto</p>
                <div className="flex gap-2 flex-wrap">
                  {accounts.map(acc => (
                    <button key={acc.id} type="button"
                      onClick={() => setAccountId(accountId === acc.id ? "" : acc.id)}
                      style={accountId === acc.id ? { backgroundColor: acc.color } : {}}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${accountId === acc.id ? "text-cream shadow-md" : "bg-cream/10 text-cream/55 border border-cream/15"}`}>
                      <span>{acc.icon}</span><span>{acc.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="kicker text-cream/40 mb-3">Alle Posten teilen</p>
              {(() => {
                const activeModes = new Set(items.filter(it => !it.excluded).map(getSplitMode))
                const allMode = activeModes.size === 1 ? [...activeModes][0] : null
                return (
                  <div className="flex gap-2 mb-4">
                    {([
                      { mode: "solo" as const, label: `Nur ${payer.label.split(" ")[0]}` },
                      { mode: "half" as const, label: "Alle 50/50" },
                      { mode: "full" as const, label: `Für ${partner.label.split(" ")[0]}` },
                    ]).map(opt => (
                      <button key={opt.mode} type="button"
                        onClick={() => setAllSplits(opt.mode)}
                        style={allMode === opt.mode && opt.mode !== "solo" ? { backgroundColor: partner.color } : {}}
                        className={`flex-1 text-xs px-3 py-2.5 rounded-2xl font-bold transition-all ${
                          allMode === opt.mode
                            ? opt.mode === "solo" ? "bg-cream/30 text-cream" : "text-cream shadow-md"
                            : "bg-cream/10 text-cream/50 border border-cream/15"
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )
              })()}

              <p className="kicker text-cream/40 mb-3">Posten — tippe zum Ausschliessen, ✎ zum Korrigieren</p>
              <div className="space-y-2">
                {items.map((item, i) => {
                  const mode = getSplitMode(item)
                  return (
                    <div key={i} className={`rounded-2xl overflow-hidden transition-all ${item.excluded ? "opacity-30" : ""}`}>
                      {editingIndex === i ? (
                        <div className="flex items-center gap-2 bg-cream/[0.07] px-3 py-2.5">
                          <input value={editName} onChange={e => setEditName(e.target.value)}
                            className="flex-1 min-w-0 bg-cream/10 border border-cream/20 rounded-xl px-3 py-2 text-sm text-cream focus:outline-none focus:border-cream/40" />
                          <input value={editAmount} onChange={e => setEditAmount(e.target.value)}
                            inputMode="decimal"
                            className="w-20 bg-cream/10 border border-cream/20 rounded-xl px-2 py-2 text-sm text-cream text-right tabular-nums focus:outline-none focus:border-cream/40" />
                          <button type="button" onClick={() => saveItemEdit(i)}
                            disabled={!editName.trim() || !parseAmount(editAmount)}
                            className="text-[#7fc89e] disabled:opacity-30 p-1.5">
                            <Check className="w-4 h-4" strokeWidth={3} />
                          </button>
                          <button type="button" onClick={() => setEditingIndex(null)} className="text-cream/40 p-1.5">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                      <div className="flex items-center gap-3 bg-cream/[0.07] px-4 py-3 cursor-pointer active:bg-cream/[0.12]" onClick={() => toggleItem(i)}>
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${item.excluded ? "border-cream/25" : "border-[#7fc89e] bg-[#7fc89e]"}`}>
                          {!item.excluded && <Check className="w-3 h-3 text-ink" strokeWidth={3} />}
                        </div>
                        <p className={`flex-1 text-sm font-semibold ${item.excluded ? "line-through text-cream/30" : "text-cream"}`}>{item.name}</p>
                        <p className={`text-sm font-bold tabular-nums ${item.excluded ? "text-cream/25" : "text-cream"}`}>CHF {item.amount.toFixed(2)}</p>
                        {!item.excluded && (
                          <button type="button"
                            onClick={e => { e.stopPropagation(); startItemEdit(i) }}
                            className="text-cream/35 hover:text-cream p-1 -mr-1">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      )}
                      {!item.excluded && (
                        <>
                          <select value={item.categoryId} onChange={e => updateCategory(i, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="w-full bg-cream/[0.04] border-t border-cream/10 px-4 py-2.5 text-xs text-cream/60 focus:outline-none">
                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                          </select>
                          <div className="bg-cream/[0.04] border-t border-cream/10 px-4 py-2.5 flex gap-2">
                            {([
                              { mode: "solo" as const, label: `Nur ${payer.label.split(" ")[0]}` },
                              { mode: "half" as const, label: "50/50" },
                              { mode: "full" as const, label: `Für ${partner.label.split(" ")[0]}` },
                            ]).map(opt => (
                              <button key={opt.mode} type="button"
                                onClick={e => { e.stopPropagation(); setSplit(i, opt.mode) }}
                                style={mode === opt.mode && opt.mode !== "solo" ? { backgroundColor: partner.color } : {}}
                                className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all flex-1 ${mode === opt.mode ? opt.mode === "solo" ? "bg-cream/30 text-cream" : "text-cream" : "bg-cream/10 text-cream/50"}`}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {item.sharedWith && (
                            <div className="bg-cream/[0.07] border-t border-cream/10 px-4 py-2 flex justify-between">
                              <p className="text-xs text-cream/45">{partner.label.split(" ")[0]} schuldet</p>
                              <p className="text-xs font-bold" style={{ color: partner.color }}>CHF {(item.amount * (item.sharedRatio ?? 0)).toFixed(2)}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="kicker text-cream/40 mb-2">Notiz</p>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="z.B. Grosseinkauf vor den Ferien…"
                rows={3}
                className="w-full bg-cream/[0.06] border border-cream/15 rounded-2xl px-4 py-3 text-sm text-cream placeholder:text-cream/25 focus:outline-none focus:border-cream/40 resize-none" />
            </div>
          </div>
        )}
      </div>

      {phase === "review" && (
        <div className="fixed bottom-0 left-0 right-0 ink-panel border-t border-cream/10 px-6 py-4 safe-bottom">
          {saveError && <p className="text-[#e89890] text-xs text-center mb-2">{saveError}</p>}
          <div className="max-w-lg mx-auto flex items-center gap-4">
            <div className="flex-1">
              <p className="amount text-cream text-lg">CHF {activeTotal.toFixed(2)}</p>
              <p className="text-cream/45 text-xs">{activeItems.length} Posten ausgewählt</p>
            </div>
            <button onClick={() => handleSave()} disabled={saving || activeItems.length === 0}
              className="bg-cream text-ink font-black px-6 py-3 rounded-2xl flex items-center gap-2 disabled:opacity-30 active:scale-95 transition-all">
              <Check className="w-4 h-4" strokeWidth={3} />
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
