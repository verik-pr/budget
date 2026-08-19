"use client"

import { useCallback, useEffect, useState } from "react"
import { formatCHF } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { TransactionList, type TxItem } from "@/components/transaction-list"
import { useConfirm } from "@/components/confirm-sheet"
import { SkeletonList } from "@/components/skeleton"
import { useToast } from "@/components/toast"
import { PullToRefresh } from "@/components/pull-to-refresh"

type Account = { id: string; name: string; icon: string; color: string }

function initialPeriodStart() {
  const today = new Date()
  return today.getDate() >= 24
    ? new Date(today.getFullYear(), today.getMonth(), 24)
    : new Date(today.getFullYear(), today.getMonth() - 1, 24)
}

export default function TransactionsPage() {
  const confirm = useConfirm()
  const toast = useToast()
  const [periodStart, setPeriodStart] = useState<Date>(initialPeriodStart)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<TxItem[]>([])
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all")
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/accounts?mine=true")
      .then(r => r.json())
      .then(({ accounts: accs, defaultId }: { accounts: Account[]; defaultId: string | null }) => {
        setAccounts(accs)
        setAccountId(defaultId)
      })
  }, [])

  const fetchTransactions = useCallback(async (showLoader: boolean) => {
    if (accountId === undefined) return
    if (showLoader) setLoading(true)
    const end = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 24)
    const params = new URLSearchParams({
      startDate: periodStart.toISOString(),
      endDate: end.toISOString(),
      ...(accountId ? { accountId } : {}),
    })
    try {
      const res = await fetch(`/api/transactions?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTransactions(data)
    } catch {
      toast("Konnte Buchungen nicht laden", "error")
    } finally {
      setLoading(false)
    }
  }, [periodStart, accountId, toast])

  useEffect(() => { fetchTransactions(true) }, [fetchTransactions])

  function prevPeriod() { setPeriodStart(p => new Date(p.getFullYear(), p.getMonth() - 1, 24)) }
  function nextPeriod() { setPeriodStart(p => new Date(p.getFullYear(), p.getMonth() + 1, 24)) }

  async function deleteTransaction(id: string) {
    const ok = await confirm({ title: "Buchung löschen?", confirmLabel: "Löschen", destructive: true })
    if (!ok) return
    const backup = transactions
    setTransactions(ts => ts.filter(t => t.id !== id))
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast("Buchung gelöscht")
    } catch {
      setTransactions(backup)
      toast("Konnte nicht gelöscht werden", "error")
    }
  }

  async function editReceipt(receiptId: string, data: { merchant: string; date: string; contributor?: string; split?: string }) {
    try {
      const res = await fetch(`/api/receipts/${receiptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error)
      }
      toast("Quittung aktualisiert")
      fetchTransactions(false)
      return true
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Konnte nicht speichern", "error")
      return false
    }
  }

  async function deleteReceipt(receiptId: string) {
    const count = transactions.filter(t => t.receiptId === receiptId).length
    const ok = await confirm({
      title: "Ganze Quittung löschen?",
      description: `Alle ${count} Posten dieser Quittung werden gelöscht.`,
      confirmLabel: "Alles löschen",
      destructive: true,
    })
    if (!ok) return
    const backup = transactions
    setTransactions(ts => ts.filter(t => t.receiptId !== receiptId))
    try {
      const res = await fetch(`/api/receipts/${receiptId}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error)
      }
      toast("Quittung gelöscht")
    } catch (e) {
      setTransactions(backup)
      toast(e instanceof Error && e.message ? e.message : "Konnte nicht gelöscht werden", "error")
    }
  }

  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 24)
  const lastDay = new Date(periodEnd.getTime() - 86400000)
  const periodLabel = `${periodStart.getDate()}. ${periodStart.toLocaleDateString("de-CH", { month: "short" })} – ${lastDay.getDate()}. ${lastDay.toLocaleDateString("de-CH", { month: "short", year: "numeric" })}`

  const visible = transactions
    .filter(t => filterType === "all" || t.category.type === filterType)
    .filter(t => !search || (t.description || t.category.name || t.receiptMerchant || "").toLowerCase().includes(search.toLowerCase()))

  const income = transactions.filter(t => t.category.type === "income").reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.category.type === "expense").reduce((s, t) => s + t.amount, 0)

  return (
    <PullToRefresh onRefresh={() => fetchTransactions(false)}>
    <div className="max-w-lg mx-auto">
      {lightbox && (
        <div className="fixed inset-0 bg-ink/95 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={`/api/photos/${lightbox}`} className="max-w-full max-h-full rounded-2xl" alt="" />
        </div>
      )}

      <div className="ink-panel px-6 pt-safe pb-4 sticky top-0 z-10 rounded-b-[28px]">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevPeriod} className="text-cream/50 hover:text-cream transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="display text-cream text-[15px]">{periodLabel}</p>
            <p className="text-xs mt-1 tabular-nums">
              <span className="text-[#7fc89e] font-semibold">+{formatCHF(income)}</span>
              <span className="mx-1.5 text-cream/25">·</span>
              <span className="text-cream/70 font-semibold">−{formatCHF(expenses)}</span>
            </p>
          </div>
          <button onClick={nextPeriod} className="text-cream/50 hover:text-cream transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {accounts.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {accounts.map(acc => (
              <button key={acc.id} type="button"
                onClick={() => setAccountId(acc.id)}
                style={accountId === acc.id ? { backgroundColor: acc.color } : {}}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-[0.97] ${accountId === acc.id ? "text-cream shadow-md" : "bg-cream/10 text-cream/55 border border-cream/15"}`}>
                <span>{acc.icon}</span><span>{acc.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…"
            className="w-full bg-cream/[0.06] border border-cream/15 rounded-xl pl-9 pr-3 py-2.5 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-cream/40" />
        </div>

        <div className="flex gap-2">
          {(["all", "expense", "income"] as const).map(f => (
            <button key={f} onClick={() => setFilterType(f)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition-all active:scale-[0.97] ${filterType === f ? "bg-cream text-ink" : "bg-cream/10 text-cream/55 border border-cream/15"}`}>
              {f === "all" ? "Alle" : f === "expense" ? "Ausgaben" : "Einnahmen"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <SkeletonList count={6} />
        ) : visible.length === 0 ? (
          <p className="text-muted text-sm text-center py-12">Keine Buchungen gefunden</p>
        ) : (
          <TransactionList
            transactions={visible}
            onDelete={deleteTransaction}
            onDeleteReceipt={deleteReceipt}
            onLightbox={path => setLightbox(path)}
            onEditReceipt={editReceipt}
          />
        )}
      </div>
    </div>
    </PullToRefresh>
  )
}
