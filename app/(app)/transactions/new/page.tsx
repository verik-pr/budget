"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Camera, X, Check, ScanLine, ArrowLeft, Sparkles } from "lucide-react"
import Link from "next/link"
import { CONTRIBUTORS, contributorFromName, formatCHF, parseAmount, todayLocalISO } from "@/lib/utils"
import { useToast } from "@/components/toast"

type Category = { id: string; name: string; icon: string; type: string }
type Account = { id: string; name: string; icon: string; color: string; type: string }

export default function NewTransactionPage() {
  const router = useRouter()
  const toast = useToast()
  const { data: session } = useSession()
  const fileRef = useRef<HTMLInputElement>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [type, setType] = useState<"expense" | "income">("expense")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(todayLocalISO())
  const [contributor, setContributor] = useState("")
  const [splitMode, setSplitMode] = useState<"solo" | "half" | "full">("solo")
  const [accountId, setAccountId] = useState("")
  const [accounts, setAccounts] = useState<Account[]>([])

  // Zahler = gewählter "Von wem"-Contributor, sonst der eingeloggte User.
  // Splits nur zwischen Erik und Céline (nicht bei Eltern) und nur bei Ausgaben.
  const sessionContrib = contributorFromName(session?.user?.name ?? "")
  const payerValue = contributor || sessionContrib
  const canSplit = type === "expense" && (payerValue === "erik" || payerValue === "celine")
  const partnerValue = payerValue === "erik" ? "celine" : "erik"
  const partner = CONTRIBUTORS.find(c => c.value === partnerValue) ?? CONTRIBUTORS[1]
  const payerFirst = (CONTRIBUTORS.find(c => c.value === payerValue)?.label ?? "Ich").split(" ")[0]
  const partnerFirst = partner.label.split(" ")[0]
  const previewAmount = parseAmount(amount)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<{ categoryId: string; confidence: number } | null>(null)
  const [userPickedCategory, setUserPickedCategory] = useState(false)

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(data => {
      setCategories(data)
      const first = data.find((c: Category) => c.type === "expense")
      if (first) setCategoryId(first.id)
    })
    fetch("/api/accounts").then(r => r.json()).then(setAccounts)
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

  useEffect(() => {
    if (description.trim().length < 3) {
      setSuggestion(null)
      return
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/ai/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description, type }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (data && data.confidence >= 0.6 && categories.find(c => c.id === data.categoryId)) {
          setSuggestion(data)
        } else {
          setSuggestion(null)
        }
      } catch {}
    }, 600)
    return () => clearTimeout(handle)
  }, [description, type, categories])

  const suggestedCat = suggestion && categories.find(c => c.id === suggestion.categoryId)
  const showSuggestion = suggestedCat && !userPickedCategory && suggestion.categoryId !== categoryId

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !categoryId || !date) return
    const parsedAmount = parseAmount(amount)
    if (!parsedAmount) {
      toast("Ungültiger Betrag", "error")
      return
    }
    setLoading(true)

    try {
      let photoPath: string | null = null
      if (photoFile) {
        const fd = new FormData()
        fd.append("file", photoFile)
        const upRes = await fetch("/api/upload", { method: "POST", body: fd })
        if (!upRes.ok) throw new Error("upload")
        const data = await upRes.json()
        photoPath = data.filename
      }

      const splitActive = canSplit && splitMode !== "solo"
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          categoryId,
          description,
          date,
          photoPath,
          // Bei Split muss der Zahler explizit gesetzt sein, sonst fällt die
          // Buchung aus der Auslagen-Abrechnung (/api/debts matcht auf contributor)
          contributor: splitActive ? payerValue : contributor || null,
          accountId: accountId || null,
          ...(splitActive ? { sharedWith: partnerValue, sharedRatio: splitMode === "half" ? 0.5 : 1.0 } : {}),
        }),
      })
      if (!res.ok) throw new Error()
      toast("Buchung gespeichert")
      router.push("/dashboard")
      router.refresh()
    } catch {
      setLoading(false)
      toast("Konnte nicht speichern", "error")
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="ink-panel px-6 pt-safe pb-4 rounded-b-[28px]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="text-cream/50 hover:text-cream transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="kicker text-cream/45">Neue Buchung</p>
        </div>
      </div>
      <div className="stagger px-6 pt-5 pb-6">

        {/* Scan shortcut */}
        <Link href="/scan"
          className="flex items-center gap-3 ink-panel rounded-2xl px-4 py-3 mb-6 active:opacity-90 transition-opacity">
          <div className="w-9 h-9 bg-cream/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <ScanLine className="w-5 h-5 text-[#7fc89e]" />
          </div>
          <div className="flex-1">
            <p className="text-cream text-sm font-bold">Quittung scannen</p>
            <p className="text-cream/45 text-xs">KI erkennt Posten automatisch</p>
          </div>
          <span className="text-cream/35 text-lg">›</span>
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
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all active:scale-[0.97] ${
                type === t
                  ? t === "expense" ? "bg-ink text-cream" : "bg-pine text-cream"
                  : "bg-card border border-rule text-muted"
              }`}>
              {t === "expense" ? "Ausgabe" : "Einnahme"}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div className="mb-8">
          <p className="kicker text-muted mb-2">Betrag CHF</p>
          <input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" required value={amount}
            onChange={e => setAmount(e.target.value)} placeholder="0.00"
            className="amount w-full bg-transparent text-ink text-[52px] leading-none focus:outline-none placeholder:text-rule" />
          <div className="h-px bg-rule mt-3" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Details */}
          <div className="space-y-4">
            <div>
              <p className="kicker text-muted mb-2">Datum</p>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-card border border-rule rounded-2xl px-4 py-3 text-ink text-sm focus:outline-none focus:border-pine/50" />
            </div>
            <div>
              <p className="kicker text-muted mb-2">Beschreibung</p>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="z.B. Migros Einkauf"
                className="w-full bg-card border border-rule rounded-2xl px-4 py-3 text-ink text-sm focus:outline-none focus:border-pine/50 placeholder:text-faint" />
            </div>
          </div>

          {/* Categories */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="kicker text-muted">Kategorie</p>
              {showSuggestion && (
                <button type="button"
                  onClick={() => { setCategoryId(suggestion!.categoryId); setUserPickedCategory(true); setSuggestion(null) }}
                  className="flex items-center gap-1.5 bg-pineSoft text-pine rounded-full px-3 py-1 text-xs font-bold active:opacity-70 ring-1 ring-pine/30">
                  <Sparkles className="w-3 h-3" />
                  <span>{suggestedCat!.icon} {suggestedCat!.name}</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {filtered.map(cat => (
                <button key={cat.id} type="button" onClick={() => { setCategoryId(cat.id); setUserPickedCategory(true) }}
                  className={`rounded-2xl py-3 px-2 text-center transition-all active:scale-[0.97] ${
                    categoryId === cat.id ? "bg-ink shadow-card" : "bg-card border border-rule"
                  }`}>
                  <div className="text-xl mb-1">{cat.icon}</div>
                  <div className={`text-[10px] font-semibold leading-tight ${categoryId === cat.id ? "text-cream" : "text-muted"}`}>
                    {cat.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Konto */}
          {accounts.length > 0 && (
            <div>
              <p className="kicker text-muted mb-3">Konto</p>
              <div className="flex gap-2 flex-wrap">
                {accounts.map(acc => (
                  <button key={acc.id} type="button"
                    onClick={() => setAccountId(accountId === acc.id ? "" : acc.id)}
                    style={accountId === acc.id ? { backgroundColor: acc.color } : {}}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.97] ${
                      accountId === acc.id ? "text-cream shadow-md" : "bg-card border border-rule text-muted"
                    }`}>
                    <span>{acc.icon}</span>
                    <span>{acc.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-faint text-xs mt-2 italic font-serif">Leer lassen = kein Konto</p>
            </div>
          )}

          {/* Von wem */}
          <div>
            <p className="kicker text-muted mb-3">Von wem</p>
            <div className="grid grid-cols-2 gap-2">
              {CONTRIBUTORS.map(c => (
                <button key={c.value} type="button"
                  onClick={() => setContributor(contributor === c.value ? "" : c.value)}
                  style={contributor === c.value ? { backgroundColor: c.color } : {}}
                  className={`rounded-2xl py-3 px-3 text-sm font-bold transition-all text-left active:scale-[0.97] ${
                    contributor === c.value ? "text-cream shadow-md" : "bg-card border border-rule text-muted"
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-faint text-xs mt-2 italic font-serif">Leer lassen = du selbst</p>
          </div>

          {/* Teilen */}
          {canSplit && (
            <div>
              <p className="kicker text-muted mb-3">Teilen</p>
              <div className="flex gap-2">
                {([
                  { mode: "solo" as const, label: `Nur ${payerFirst}` },
                  { mode: "half" as const, label: "50/50" },
                  { mode: "full" as const, label: `Für ${partnerFirst}` },
                ]).map(opt => (
                  <button key={opt.mode} type="button"
                    onClick={() => setSplitMode(opt.mode)}
                    style={splitMode === opt.mode && opt.mode !== "solo" ? { backgroundColor: partner.color } : {}}
                    className={`flex-1 px-3 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.97] ${
                      splitMode === opt.mode
                        ? opt.mode === "solo" ? "bg-ink text-cream shadow-md" : "text-cream shadow-md"
                        : "bg-card border border-rule text-muted"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {splitMode !== "solo" && previewAmount !== null && (
                <div className="flex justify-between mt-2 px-1">
                  <p className="text-xs text-muted">{partnerFirst} schuldet</p>
                  <p className="text-xs font-bold tabular-nums" style={{ color: partner.color }}>
                    CHF {(previewAmount * (splitMode === "half" ? 0.5 : 1)).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Photo */}
          <div>
            <p className="kicker text-muted mb-3">Quittung</p>
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              onChange={handlePhoto} className="hidden" />
            {photoPreview ? (
              <div className="relative rounded-2xl overflow-hidden">
                <img src={photoPreview} className="w-full h-40 object-cover" alt="Vorschau" />
                <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                  className="absolute top-3 right-3 bg-ink/70 rounded-full p-1.5">
                  <X className="w-4 h-4 text-cream" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full bg-card border border-rule border-dashed rounded-2xl py-5 flex flex-col items-center gap-2 text-muted hover:border-pine/40 transition-colors">
                <Camera className="w-5 h-5" />
                <span className="text-xs font-medium">Foto hinzufügen</span>
              </button>
            )}
          </div>

          <button type="submit" disabled={loading || !amount || !categoryId}
            className="w-full bg-pine hover:bg-pineDark text-cream rounded-2xl py-4 font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
            <Check className="w-4 h-4" />
            {loading ? "Speichern…" : "Buchung speichern"}
          </button>
        </form>
      </div>
    </div>
  )
}
