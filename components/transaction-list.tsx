"use client"

import { useState } from "react"
import { formatCHF, formatDate, getContributorLabel } from "@/lib/utils"
import { ChevronDown, ChevronUp, Pencil, Trash2, Image } from "lucide-react"
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
}: {
  group: ReceiptGroup
  onDelete?: (id: string) => void
  onLightbox?: (path: string) => void
}) {
  const [open, setOpen] = useState(false)
  const icons = [...new Set(group.items.map(i => i.category.icon))].slice(0, 3)
  const isExpense = group.items.every(i => i.category.type === "expense")

  return (
    <div>
      <button
        className="w-full flex items-center gap-4 px-5 py-4 active:bg-gray-50 transition-colors text-left"
        onClick={() => setOpen(o => !o)}>
        <div className="w-8 text-center text-xl leading-none flex-shrink-0">
          {icons.length === 1 ? icons[0] : "🛒"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{group.merchant}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(group.date)} · {group.items.length} Posten</p>
        </div>
        <p className="text-sm font-bold tabular-nums text-gray-900 flex-shrink-0">
          {isExpense ? "−" : ""}{formatCHF(group.total)}
        </p>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-300 flex-shrink-0 ml-1" />
          : <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0 ml-1" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          {group.items.map((tx, i) => (
            <div key={tx.id}
              className={`flex items-center gap-3 px-5 py-3 pl-14 ${i < group.items.length - 1 ? "border-b border-gray-100" : ""}`}>
              <span className="text-base w-6 text-center flex-shrink-0">{tx.category.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{tx.description || tx.category.name}</p>
                <p className="text-xs text-gray-400">{tx.category.name} · {getContributorLabel(tx.contributor, tx.user.name)}</p>
              </div>
              <p className="text-xs font-bold tabular-nums text-gray-700 flex-shrink-0">
                {tx.category.type === "income" ? "+" : "−"}{formatCHF(tx.amount)}
              </p>
              {onDelete && (
                <div className="flex gap-1 ml-1">
                  <Link href={`/transactions/${tx.id}/edit`} className="text-gray-300 hover:text-blue-400 p-1">
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  <button onClick={() => onDelete(tx.id)} className="text-gray-200 hover:text-red-400 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {group.items[0]?.note && (
            <p className="px-5 pb-3 text-xs text-gray-400 italic">📝 {group.items[0].note}</p>
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
}: {
  transactions: TxItem[]
  onDelete?: (id: string) => void
  onLightbox?: (path: string) => void
}) {
  const rows = groupTransactions(transactions)

  if (rows.length === 0) return null

  return (
    <div className="bg-white rounded-3xl overflow-hidden">
      {rows.map((row, i) => {
        const isLast = i === rows.length - 1
        if (row.kind === "group") {
          return (
            <div key={row.group.receiptId} className={!isLast ? "border-b border-gray-100" : ""}>
              <ReceiptCard group={row.group} onDelete={onDelete} onLightbox={onLightbox} />
            </div>
          )
        }
        const t = row.tx
        return (
          <div key={t.id} className={!isLast ? "border-b border-gray-100" : ""}>
            <div className="flex items-center gap-4 px-5 py-4">
              <span className="text-2xl w-8 text-center flex-shrink-0">{t.category.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {t.description || t.category.name}
                  {t.recurringId && <span className="text-gray-300 ml-1 font-normal">↻</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(t.date)} · {getContributorLabel(t.contributor, t.user.name)}
                  {t.account && <span style={{ color: t.account.color }}> · {t.account.icon} {t.account.name}</span>}
                </p>
                {t.note && <p className="text-xs text-gray-400 italic mt-0.5 truncate">📝 {t.note}</p>}
              </div>
              <p className={`text-sm font-bold tabular-nums flex-shrink-0 ${t.category.type === "income" ? "text-green-500" : "text-gray-900"}`}>
                {t.category.type === "income" ? "+" : "−"}{formatCHF(t.amount)}
              </p>
              {onLightbox && t.photoPath && (
                <button onClick={() => onLightbox(t.photoPath!)} className="text-gray-300 hover:text-blue-400 p-1">
                  <Image className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <>
                  <Link href={`/transactions/${t.id}/edit`} className="text-gray-300 hover:text-blue-400 p-1">
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button onClick={() => onDelete(t.id)} className="text-gray-200 hover:text-red-400 p-1">
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
