"use client"

import { useState } from "react"
import { formatCHF, formatDate, getContributorLabel } from "@/lib/utils"
import { ChevronDown, ChevronUp } from "lucide-react"

type Transaction = {
  id: string
  date: Date | string
  amount: number
  description: string | null
  contributor: string | null
  recurringId: string | null
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
  items: Transaction[]
}

type Row =
  | { kind: "single"; tx: Transaction }
  | { kind: "group"; group: ReceiptGroup }

function groupTransactions(transactions: Transaction[]): Row[] {
  const groups = new Map<string, ReceiptGroup>()
  const rows: Row[] = []
  const seen = new Set<string>()

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

function ReceiptCard({ group }: { group: ReceiptGroup }) {
  const [open, setOpen] = useState(false)
  const icons = [...new Set(group.items.map(i => i.category.icon))].slice(0, 3)

  return (
    <div>
      <button
        className="w-full flex items-center gap-4 px-5 py-4 active:bg-gray-50 transition-colors text-left"
        onClick={() => setOpen(o => !o)}>
        <div className="w-8 text-center text-xl leading-none">
          {icons.length === 1 ? icons[0] : "🛒"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{group.merchant}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(group.date)} · {group.items.length} Posten
          </p>
        </div>
        <p className="text-sm font-bold tabular-nums text-gray-900 mr-2">
          −{formatCHF(group.total)}
        </p>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-300 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {group.items.map((tx, i) => (
            <div key={tx.id}
              className={`flex items-center gap-4 px-5 py-3 pl-16 ${i < group.items.length - 1 ? "border-b border-gray-50" : ""}`}>
              <span className="text-lg w-6 text-center flex-shrink-0">{tx.category.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{tx.description || tx.category.name}</p>
                <p className="text-xs text-gray-400">{tx.category.name}</p>
                {tx.note && <p className="text-xs text-gray-400 italic mt-0.5 truncate">"{tx.note}"</p>}
              </div>
              <p className="text-xs font-bold tabular-nums text-gray-700">−{formatCHF(tx.amount)}</p>
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

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const rows = groupTransactions(transactions)

  return (
    <div className="bg-white rounded-3xl overflow-hidden">
      {rows.map((row, i) => {
        const isLast = i === rows.length - 1
        if (row.kind === "group") {
          return (
            <div key={row.group.receiptId} className={!isLast ? "border-b border-gray-100" : ""}>
              <ReceiptCard group={row.group} />
            </div>
          )
        }
        const t = row.tx
        return (
          <div key={t.id} className={`flex items-center gap-4 px-5 py-4 ${!isLast ? "border-b border-gray-100" : ""}`}>
            <span className="text-2xl w-8 text-center">{t.category.icon}</span>
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
            <p className={`text-sm font-bold tabular-nums ${t.category.type === "income" ? "text-green-500" : "text-gray-900"}`}>
              {t.category.type === "income" ? "+" : "−"}{formatCHF(t.amount)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
