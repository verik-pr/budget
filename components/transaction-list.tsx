"use client"

import { useState } from "react"
import { CONTRIBUTORS, contributorFromName, formatCHF, formatDate, getContributorLabel } from "@/lib/utils"
import { Check, ChevronDown, ChevronUp, Pencil, Trash2, Image, X } from "lucide-react"
import Link from "next/link"

export type TxItem = {
  id: string
  date: Date | string
  amount: number
  description: string | null
  photoPath?: string | null
  contributor: string | null
  sharedWith?: string | null
  sharedRatio?: number | null
  recurringId?: string | null
  faceAmount?: number | null
  receiptId: string | null
  receiptMerchant: string | null
  note: string | null
  isPrivate?: boolean
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

export type ReceiptEditData = {
  merchant: string
  date: string
  contributor?: "erik" | "celine"
  split?: "solo" | "half" | "full"
}

function ReceiptCard({
  group,
  onDelete,
  onLightbox,
  onEditReceipt,
  onDeleteReceipt,
}: {
  group: ReceiptGroup
  onDelete?: (id: string) => void
  onLightbox?: (path: string) => void
  onEditReceipt?: (receiptId: string, data: ReceiptEditData) => Promise<boolean>
  onDeleteReceipt?: (receiptId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editMerchant, setEditMerchant] = useState("")
  const [editDate, setEditDate] = useState("")
  const [editPayer, setEditPayer] = useState<"" | "erik" | "celine">("")
  const [editSplit, setEditSplit] = useState<"" | "solo" | "half" | "full">("")
  const [savingEdit, setSavingEdit] = useState(false)
  const icons = [...new Set(group.items.map(i => i.category.icon))].slice(0, 3)
  const isExpense = group.items.every(i => i.category.type === "expense")

  // Einheitlicher Zahler/Split über alle Posten? Sonst leer (gemischt) —
  // dann werden die Chips erst beim Antippen für alle gesetzt.
  const payerOf = (t: TxItem) => t.contributor || contributorFromName(t.user.name)
  const modeOf = (t: TxItem): "solo" | "half" | "full" => !t.sharedWith ? "solo" : t.sharedRatio === 0.5 ? "half" : "full"
  const payers = [...new Set(group.items.map(payerOf))]
  const modes = [...new Set(group.items.map(modeOf))]
  const uniformPayer = payers.length === 1 && (payers[0] === "erik" || payers[0] === "celine") ? payers[0] as "erik" | "celine" : ""
  const uniformMode = modes.length === 1 ? modes[0] : ""
  const mixed = uniformPayer === "" || uniformMode === ""

  function startEdit() {
    setEditMerchant(group.merchant)
    setEditDate(new Date(group.date).toISOString().split("T")[0])
    setEditPayer(uniformPayer)
    setEditSplit(uniformPayer ? uniformMode : "")
    setEditing(true)
  }

  // Zahler & Aufteilung gelten nur zusammen — Wahl des einen aktiviert das andere
  function pickPayer(p: "erik" | "celine") {
    setEditPayer(p)
    if (!editSplit) setEditSplit(uniformMode || "solo")
  }
  function pickSplit(m: "solo" | "half" | "full") {
    setEditSplit(m)
    if (!editPayer) setEditPayer(uniformPayer || (payerOf(group.items[0]) === "celine" ? "celine" : "erik"))
  }

  async function saveEdit() {
    if (!onEditReceipt || !editMerchant.trim() || !editDate) return
    setSavingEdit(true)
    const ok = await onEditReceipt(group.receiptId, {
      merchant: editMerchant.trim(),
      date: editDate,
      ...(editPayer && editSplit ? { contributor: editPayer, split: editSplit } : {}),
    })
    setSavingEdit(false)
    if (ok) setEditing(false)
  }

  const payerFirst = (CONTRIBUTORS.find(c => c.value === editPayer)?.label ?? "Zahler").split(" ")[0]
  const partnerFirst = (CONTRIBUTORS.find(c => c.value === (editPayer === "celine" ? "erik" : "celine"))?.label ?? "Partner").split(" ")[0]

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
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-faint text-[11px] mr-0.5">Bezahlt von</span>
            {CONTRIBUTORS.filter(c => c.value === "erik" || c.value === "celine").map(c => (
              <button key={c.value} type="button" onClick={() => pickPayer(c.value as "erik" | "celine")}
                style={editPayer === c.value ? { backgroundColor: c.color, color: "#fff" } : {}}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${editPayer === c.value ? "shadow" : "bg-paper border border-rule text-muted"}`}>
                {c.label.split(" ")[0]}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-faint text-[11px] mr-0.5">Teilen</span>
            {([["solo", `Nur ${editPayer ? payerFirst : "Zahler"}`], ["half", "50/50"], ["full", `Für ${partnerFirst}`]] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => pickSplit(m)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${editSplit === m ? "bg-ink text-cream shadow" : "bg-paper border border-rule text-muted"}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-faint text-xs italic font-serif">
            Gilt für alle {group.items.length} Posten dieser Quittung.
            {mixed && !editPayer && " Zahler/Aufteilung sind gemischt — eine Auswahl setzt sie für alle."}
          </p>
          {onDeleteReceipt && (
            <button type="button" onClick={() => onDeleteReceipt(group.receiptId)}
              className="flex items-center gap-1.5 text-blood text-xs font-bold pt-1">
              <Trash2 className="w-3.5 h-3.5" />Ganze Quittung löschen ({group.items.length} Posten)
            </button>
          )}
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
            <p className="text-xs text-muted mt-0.5">
              {formatDate(group.date)} · {group.items.length} Posten
              {(() => {
                const faceTotal = group.items.reduce((s, i) => s + (i.faceAmount ?? i.amount), 0)
                return Math.abs(faceTotal - group.total) >= 0.005 ? <span> · 🧾 Beleg {formatCHF(faceTotal)}</span> : null
              })()}
            </p>
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
              <div className="flex-shrink-0 text-right">
                <p className="amount text-[13px] text-inkSoft">
                  {tx.category.type === "income" ? "+" : "−"}{formatCHF(tx.amount)}
                </p>
                {tx.faceAmount != null && Math.abs(tx.faceAmount - tx.amount) >= 0.005 && (
                  <p className="text-[10px] text-faint line-through">{formatCHF(tx.faceAmount)}</p>
                )}
              </div>
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
  onDeleteReceipt,
}: {
  transactions: TxItem[]
  onDelete?: (id: string) => void
  onLightbox?: (path: string) => void
  onEditReceipt?: (receiptId: string, data: ReceiptEditData) => Promise<boolean>
  onDeleteReceipt?: (receiptId: string) => void
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
              <ReceiptCard group={row.group} onDelete={onDelete} onLightbox={onLightbox} onEditReceipt={onEditReceipt} onDeleteReceipt={onDeleteReceipt} />
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
                  {t.isPrivate && <span className="mr-1">🔒</span>}
                  {t.description || (t.isPrivate ? "Privat" : t.category.name)}
                  {t.recurringId && <span className="text-faint ml-1 font-normal">↻</span>}
                </p>
                <p className="text-xs text-muted mt-0.5 truncate">
                  {formatDate(t.date)} · {getContributorLabel(t.contributor, t.user.name)}
                  {t.account && <span style={{ color: t.account.color }}> · {t.account.icon} {t.account.name}</span>}
                  {t.faceAmount != null && Math.abs(t.faceAmount - t.amount) >= 0.005 && <span> · 🧾 Beleg {formatCHF(t.faceAmount)}</span>}
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
