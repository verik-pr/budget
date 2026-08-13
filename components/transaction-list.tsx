"use client"

import { useState } from "react"
import { formatCHF, formatDate, getContributorLabel } from "@/lib/utils"
import { Check, ChevronDown, ChevronUp, Pencil, Trash2, Image, X } from "lucide-react"
import Link from "next/link"

export type TxItem = {
  id: string
  date: Date | string
  amount: number
  description: string | null
  photoPath?: string | null
  contributor: string | null
  recurringId?: string | null
  receiptId: string | null
  receiptMerchant: string | null
  note: string | null
  category: { id: string; name: string; icon: string; type: string }
  user: { id: string; name: string; color: string }
  account: { id: string; name: string; icon: string; color: string } | null
}

type ReceiptGroup = {
  receiptId: string
  merchant: string
  date: Date | string
  total: number
  items: TxItem[]
}

type Row = { kind: "single"; tx: TxItem } | { kind: "group"; group: ReceiptGroup }

function groupTransactions(transactions: TxItem[]): Row[] {
  const groups = new Map<string, ReceiptGroup>()
  const rows: Row[] = []

  for (const tx of transactions) {
    if (tx.receiptId) {
      if (!groups.has(tx.receiptId)) {
        const g: ReceiptGroup = {
          receiptId: tx.receiptId,
          merchant: tx.receiptMerchant ?? tx.description ?? "Quittung",
          date: tx.date,
          total: 0,
          items: [],
        }
        groups.set(tx.receiptId, g)
        rows.push({ kind: "group", group: g })
      }
      const g = groups.get(tx.receiptId)!
      g.items.push(tx)
      g.total += tx.amount
    } else {
      rows.push({ kind: "single", tx })
    }
  }

  return rows
}

function ReceiptCard({
  group,
  onDelete,
  onLightbox,
  onEditReceipt,
}: {
  group: ReceiptGroup
  onDelete?: (id: string) => void
  onLightbox?: (path: string) => void
  onEditReceipt?: (receiptId: string, data: { merchant: string; date: string }) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editMerchant, setEditMerchant] = useState("")
  const [editDate, setEditDate] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const icons = [...new Set(group.items.map(i => i.category.icon))].slice(0, 3)
  const isExpense = group.items.every(i => i.category.type === "expense")

  function startEdit() {
    setEditMerchant(group.merchant)
    setEditDate(new Date(group.date).toISOString().split("T")[0])
    setEditing(true)
  }

  async function saveEdit() {
    if (!onEditReceipt || !editMerchant.trim() || !editDate) return
    setSavingEdit(true)
    const ok = await onEditReceipt(group.receiptId, { merchant: editMerchant.trim(), date: editDate })
    setSavingEdit(false)
    if (ok) setEditing(false)
  }

  return (
    <div>
      {editing ? (
        <div className="px-4 py-3 space-y-2">
          <input value={editMerchant} onChange={e => setEditMerchant(e.target.value)}
            placeholder="Titel der Quittung"
            className="w-full bg-paper border border-rule rounded-xl px-3 py-2 text-sm font-semibold text-ink focus:outline-none focus:border-pine/50" />
          <div className="flex items-center gap-2">
            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
              className="flex-1 bg-paper border border-rule rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-pine/50" />
            <button type="button" onClick={saveEdit}
              disabled={savingEdit || !editMerchant.trim() || !editDate}
              className="text-pine disabled:opacity-30 p-1.5">
              <Check className="w-4 h-4" strokeWidth={3} />
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-faint p-1.5">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-faint text-xs italic font-serif">Gilt für alle {group.items.length} Posten dieser Quittung.</p>
        </div>
      ) : (
      <div className="flex items-center">
        <button
          className="flex-1 min-w-0 flex items-center gap-3 px-4 py-4 active:bg-paper/60 transition-colors text-left"
          onClick={() => setOpen(o => !o)}>
          <div className="w-8 text-center text-xl leading-none flex-shrink-0">
            {icons.length === 1 ? icons[0] : "🛒"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{group.merchant}</p>
            <p className="text-xs text-muted mt-0.5">{formatDate(group.date)} · {group.items.length} Posten</p>
          </div>
          <p className="amount text-[15px] text-ink flex-shrink-0">
            {isExpense ? "−" : ""}{formatCHF(group.total)}
          </p>
          {open
            ? <ChevronUp className="w-4 h-4 text-faint flex-shrink-0 ml-1" />
            : <ChevronDown className="w-4 h-4 text-faint flex-shrink-0 ml-1" />}
        </button>
        {onEditReceipt && (
          <button type="button" onClick={startEdit} className="text-faint hover:text-pine p-1.5 mr-2 flex-shrink-0">
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>
      )}

      {open && (
        <div className="border-t border-rule/60 bg-paper/50">
          {group.items.map((tx, i) => (
            <div key={tx.id}
              className={`flex items-center gap-3 px-5 py-3 pl-14 ${i < group.items.length - 1 ? "border-b border-rule/40" : ""}`}>
              <span className="text-base w-6 text-center flex-shrink-0">{tx.category.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-inkSoft truncate">{tx.description || tx.category.name}</p>
                <p className="text-xs text-muted">{tx.category.name} · {getContributorLabel(tx.contributor, tx.user.name)}</p>
              </div>
              <p className="amount text-[13px] text-inkSoft flex-shrink-0">
                {tx.category.type === "income" ? "+" : "−"}{formatCHF(tx.amount)}
              </p>
              {onDelete && (
                <div className="flex gap-1 ml-1">
                  <Link href={`/transactions/${tx.id}/edit`} className="text-faint hover:text-pine p-1">
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  <button onClick={() => onDelete(tx.id)} className="text-faint hover:text-blood p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {group.items[0]?.note && (
            <p className="px-5 pb-3 text-xs text-muted italic">📝 {group.items[0].note}</p>
          )}
        </div>
      )}
    </div>
  )
}

export function TransactionList({
  transactions,
  onDelete,
  onLightbox,
  onEditReceipt,
}: {
  transactions: TxItem[]
  onDelete?: (id: string) => void
  onLightbox?: (path: string) => void
  onEditReceipt?: (receiptId: string, data: { merchant: string; date: string }) => Promise<boolean>
}) {
  const rows = groupTransactions(transactions)

  if (rows.length === 0) return null

  return (
    <div className="bg-card border border-rule shadow-card rounded-3xl overflow-hidden">
      {rows.map((row, i) => {
        const isLast = i === rows.length - 1
        if (row.kind === "group") {
          return (
            <div key={row.group.receiptId} className={!isLast ? "border-b border-rule/60" : ""}>
              <ReceiptCard group={row.group} onDelete={onDelete} onLightbox={onLightbox} onEditReceipt={onEditReceipt} />
            </div>
          )
        }
        const t = row.tx
        return (
          <div key={t.id} className={!isLast ? "border-b border-rule/60" : ""}>
            <div className="flex items-center gap-3 px-4 py-4">
              <span className="text-2xl w-8 text-center flex-shrink-0">{t.category.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">
                  {t.description || t.category.name}
                  {t.recurringId && <span className="text-faint ml-1 font-normal">↻</span>}
                </p>
                <p className="text-xs text-muted mt-0.5 truncate">
                  {formatDate(t.date)} · {getContributorLabel(t.contributor, t.user.name)}
                  {t.account && <span style={{ color: t.account.color }}> · {t.account.icon} {t.account.name}</span>}
                </p>
                {t.note && <p className="text-xs text-muted italic mt-0.5 truncate">📝 {t.note}</p>}
              </div>
              <p className={`amount text-[15px] flex-shrink-0 ${t.category.type === "income" ? "text-pine" : "text-ink"}`}>
                {t.category.type === "income" ? "+" : "−"}{formatCHF(t.amount)}
              </p>
              {onLightbox && t.photoPath && (
                <button onClick={() => onLightbox(t.photoPath!)} className="text-faint hover:text-pine p-0.5">
                  <Image className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <>
                  <Link href={`/transactions/${t.id}/edit`} className="text-faint hover:text-pine p-0.5">
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button onClick={() => onDelete(t.id)} className="text-faint hover:text-blood p-0.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            {t.photoPath && onLightbox && (
              <button onClick={() => onLightbox(t.photoPath!)} className="block w-full">
                <img src={`/api/photos/${t.photoPath}`} className="w-full h-32 object-cover" alt="Quittung" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
