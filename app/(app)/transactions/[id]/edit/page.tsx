"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Check, ArrowLeft } from "lucide-react"
import { CONTRIBUTORS, contributorFromName, formatCHF, giftcardFactor, parseAmount } from "@/lib/utils"
import { Skeleton } from "@/components/skeleton"
import { useToast } from "@/components/toast"

type Category = { id: string; name: string; icon: string; type: string }
type Account = {
  id: string; name: string; icon: string; color: string; type: string
  giftcardFaceValue?: number | null; giftcardPrice?: number | null; giftcardRemaining?: number
}

export default function EditTransactionPage() {
  const router = useRouter()
  const toast = useToast()
  const { data: session } = useSession()
  const { id } = useParams<{ id: string }>()

  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [type, setType] = useState<"expense" | "income">("expense")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [contributor, setContributor] = useState("")
  const [splitMode, setSplitMode] = useState<"solo" | "half" | "full">("solo")
  const [accountId, setAccountId] = useState("")
  const [txUserName, setTxUserName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Zahler-Fallback: der ERSTELLER der Buchung (nicht der editierende Session-
  // User) — sonst kippt ein nachträglicher Split durch den Partner die
  // Schuldrichtung
  const fallbackName = txUserName || session?.user?.name || ""
  const payerValue = contributor || contributorFromName(fallbackName)
  const canSplit = type === "expense" && (payerValue === "erik" || payerValue === "celine")
  const partnerValue = payerValue === "erik" ? "celine" : "erik"
  const partner = CONTRIBUTORS.find(c => c.value === partnerValue) ?? CONTRIBUTORS[1]
  const payerFirst = (CONTRIBUTORS.find(c => c.value === payerValue)?.label ?? "Ich").split(" ")[0]
  const partnerFirst = partner.label.split(" ")[0]
  const previewAmount = parseAmount(amount)
  const splitHint =
    splitMode === "solo"
      ? `${payerFirst} trägt die Kosten allein.`
      : splitMode === "half"
        ? `Ihr teilt 50/50 — ${partnerFirst} übernimmt ${previewAmount !== null ? formatCHF(previewAmount / 2) : "die Hälfte"}.`
        : `${payerFirst} hat nur ausgelegt — ${partnerFirst} übernimmt ${previewAmount !== null ? formatCHF(previewAmount) : "den ganzen Betrag"}.`
  const selectedAccount = accounts.find(a => a.id === accountId)
  const gcFactor = giftcardFactor(selectedAccount)
  const giftcardHint = selectedAccount?.type === "giftcard"
    ? `🎁 Guthaben-Karte · Rest ${formatCHF(selectedAccount.giftcardRemaining ?? 0)}` +
      (gcFactor < 1
        ? ` · ${Math.round((1 - gcFactor) * 100)}% Rabatt${previewAmount !== null ? ` — ${formatCHF(previewAmount)} kosten effektiv ${formatCHF(previewAmount * gcFactor)}` : ""}`
        : "")
    : null

  useEffect(() => {
    Promise.all([
      fetch(`/api/transactions/${id}`).then(r => r.ok ? r.json() : null),
      fetch("/api/categories").then(r => r.json()),
      fetch("/api/accounts").then(r => r.json()),
    ]).then(([tx, cats, accs]) => {
      if (!tx || !tx.category) {
        toast("Buchung nicht gefunden", "error")
        router.replace("/transactions")
        return
      }
      setCategories(cats)
      setAccounts(accs)
      setType(tx.category.type)
      // Bei Geschenkkarten-Buchungen wird der Beleg-Betrag bearbeitet,
      // nicht der effektive Preis — der Server rechnet beim Speichern um
      setAmount(String(tx.faceAmount ?? tx.amount))
      setCategoryId(tx.categoryId)
      setDescription(tx.description ?? "")
      setDate(new Date(tx.date).toISOString().split("T")[0])
      // Zahler vorbelegen: gespeicherter Contributor, sonst der ERSTELLER der
      // Buchung (nicht der editierende Session-User) — sonst kippt ein nach-
      // träglicher Split durch den Partner die Schuldrichtung
      setContributor(tx.contributor ?? contributorFromName(tx.user?.name ?? ""))
      setSplitMode(tx.sharedWith ? (tx.sharedRatio === 0.5 ? "half" : "full") : "solo")
      setAccountId(tx.accountId ?? "")
      setTxUserName(tx.user?.name ?? "")
      setLoading(false)
    }).catch(() => {
      toast("Konnte Buchung nicht laden", "error")
      router.replace("/transactions")
    })
  }, [id, router, toast])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !categoryId || !date) return
    const parsedAmount = parseAmount(amount)
    if (!parsedAmount) {
      toast("Ungültiger Betrag", "error")
      return
    }
    setSaving(true)
    try {
      const splitActive = canSplit && splitMode !== "solo"
      const res = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          categoryId,
          description,
          date,
          contributor: splitActive ? payerValue : contributor || null,
          accountId: accountId || null,
          sharedWith: splitActive ? partnerValue : null,
          sharedRatio: splitActive ? (splitMode === "half" ? 0.5 : 1.0) : null,
        }),
      })
      if (!res.ok) throw new Error()
      toast("Buchung aktualisiert")
      router.back()
    } catch {
      setSaving(false)
      toast("Konnte nicht speichern", "error")
    }
  }

  const filtered = categories.filter(c => c.type === type)

  if (loading) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="px-6 pt-safe pb-6 space-y-5">
          <Skeleton light className="h-5 w-32" />
          <Skeleton light className="h-14 w-full" />
          <Skeleton light className="h-14 w-full" />
          <Skeleton light className="h-32 w-full" />
          <Skeleton light className="h-14 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="ink-panel px-6 pt-safe pb-4 rounded-b-[28px]">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-cream/50 hover:text-cream transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="kicker text-cream/45">Buchung bearbeiten</p>
        </div>
      </div>
      <div className="stagger px-6 pt-5 pb-6">

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

        <div className="mb-8">
          <p className="kicker text-muted mb-2">Betrag CHF</p>
          <input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" required value={amount}
            onChange={e => setAmount(e.target.value)}
            className="amount w-full bg-transparent text-ink text-[52px] leading-none focus:outline-none" />
          <div className="h-px bg-rule mt-3" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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

          <div>
            <p className="kicker text-muted mb-3">Kategorie</p>
            <div className="grid grid-cols-4 gap-2">
              {filtered.map(cat => (
                <button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)}
                  className={`rounded-2xl py-3 px-2 text-center transition-all active:scale-[0.97] ${categoryId === cat.id ? "bg-ink shadow-card" : "bg-card border border-rule"}`}>
                  <div className="text-xl mb-1">{cat.icon}</div>
                  <div className={`text-[10px] font-semibold leading-tight ${categoryId === cat.id ? "text-cream" : "text-muted"}`}>
                    {cat.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Bezahlt von */}
          <div>
            <p className="kicker text-muted mb-3">{type === "expense" ? "Bezahlt von" : "Einnahme von"}</p>
            <div className="grid grid-cols-2 gap-2">
              {CONTRIBUTORS.map(c => (
                <button key={c.value} type="button"
                  onClick={() => setContributor(c.value)}
                  style={contributor === c.value ? { backgroundColor: c.color } : {}}
                  className={`rounded-2xl py-3 px-3 text-sm font-bold transition-all text-left active:scale-[0.97] ${contributor === c.value ? "text-cream shadow-md" : "bg-card border border-rule text-muted"}`}>
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-faint text-xs mt-2 italic font-serif">
              {type === "expense" ? "Wer das Geld ausgegeben hat — egal von welchem Konto." : "Wessen Einnahme das ist."}
            </p>
          </div>

          {/* Kosten teilen */}
          {canSplit && (
            <div>
              <p className="kicker text-muted mb-3">Kosten teilen</p>
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
              <p className="text-faint text-xs mt-2 italic font-serif">{splitHint}</p>
            </div>
          )}

          {/* Konto */}
          {accounts.length > 0 && (
            <div>
              <p className="kicker text-muted mb-3">Konto</p>
              <div className="flex gap-2 flex-wrap">
                {accounts.map(acc => (
                  <button key={acc.id} type="button"
                    onClick={() => setAccountId(accountId === acc.id ? "" : acc.id)}
                    style={accountId === acc.id ? { backgroundColor: acc.color } : {}}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.97] ${accountId === acc.id ? "text-cream shadow-md" : "bg-card border border-rule text-muted"}`}>
                    <span>{acc.icon}</span>
                    <span>{acc.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-faint text-xs mt-2 italic font-serif">
                {giftcardHint ?? (type === "expense" ? "Optional: über welches Konto bezahlt wurde." : "Optional: auf welches Konto das Geld kam.")}
              </p>
            </div>
          )}

          <button type="submit" disabled={saving || !amount || !categoryId}
            className="w-full bg-pine text-cream rounded-2xl py-4 font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
            <Check className="w-4 h-4" />
            {saving ? "Speichern…" : "Änderungen speichern"}
          </button>
        </form>
      </div>
    </div>
  )
}
