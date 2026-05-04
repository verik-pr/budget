"use client"

import { useEffect, useState } from "react"
import { formatCHF, formatDate } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

type DebtTx = {
  id: string
  date: string
  amount: number
  description: string | null
  category: { name: string; icon: string }
  sharedRatio: number
  theirShare: number
  direction: "owesMe" | "iOwe"
}

type DebtData = {
  net: number
  partnerOwesMe: number
  iOwePartner: number
  partnerLabel: string
  partnerColor: string
  myLabel: string
  transactions: DebtTx[]
}

export default function AbrechnungPage() {
  const router = useRouter()
  const [data, setData] = useState<DebtData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/debts")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading || !data) {
    return (
      <div className="max-w-lg mx-auto min-h-screen bg-black flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Laden…</p>
      </div>
    )
  }

  const owesMe = data.transactions.filter(t => t.direction === "owesMe")
  const iOwe = data.transactions.filter(t => t.direction === "iOwe")

  const partnerOwes = data.net > 0
  const netAmount = Math.abs(data.net)

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-black">
      <div className="px-6 pt-safe pb-24">

        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="text-zinc-500 text-xs font-semibold tracking-widest uppercase">Abrechnung</p>
        </div>

        {/* Net balance card */}
        <div className="rounded-3xl p-6 mb-8" style={{ backgroundColor: data.partnerColor + "20", border: `1px solid ${data.partnerColor}40` }}>
          {netAmount < 0.01 ? (
            <div className="text-center">
              <p className="text-white text-xl font-bold mb-1">Alles ausgeglichen</p>
              <p className="text-zinc-400 text-sm">Keine offenen Schulden</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: data.partnerColor }}>
                {partnerOwes ? `${data.partnerLabel} schuldet dir` : `Du schuldest ${data.partnerLabel}`}
              </p>
              <p className="text-white text-4xl font-black tabular-nums">{formatCHF(netAmount)}</p>
              {data.partnerOwesMe > 0 && data.iOwePartner > 0 && (
                <p className="text-zinc-500 text-xs mt-2">
                  {data.partnerLabel} schuldet {formatCHF(data.partnerOwesMe)} · Du schuldest {formatCHF(data.iOwePartner)}
                </p>
              )}
            </>
          )}
        </div>

        {/* Transactions where partner owes me */}
        {owesMe.length > 0 && (
          <div className="mb-6">
            <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-3">
              {data.partnerLabel} schuldet dir
            </p>
            <div className="bg-white rounded-3xl overflow-hidden">
              {owesMe.map((t, i) => (
                <div key={t.id} className={`flex items-center gap-4 px-5 py-4 ${i < owesMe.length - 1 ? "border-b border-gray-100" : ""}`}>
                  <span className="text-2xl w-8 text-center">{t.category.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.description || t.category.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(t.date)} · {t.sharedRatio === 0.5 ? "50/50" : "Alles"} von {formatCHF(t.amount)}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums" style={{ color: data.partnerColor }}>
                    +{formatCHF(t.theirShare)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions where I owe partner */}
        {iOwe.length > 0 && (
          <div className="mb-6">
            <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-3">
              Du schuldest {data.partnerLabel}
            </p>
            <div className="bg-white rounded-3xl overflow-hidden">
              {iOwe.map((t, i) => (
                <div key={t.id} className={`flex items-center gap-4 px-5 py-4 ${i < iOwe.length - 1 ? "border-b border-gray-100" : ""}`}>
                  <span className="text-2xl w-8 text-center">{t.category.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.description || t.category.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(t.date)} · {t.sharedRatio === 0.5 ? "50/50" : "Alles"} von {formatCHF(t.amount)}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-gray-700">
                    -{formatCHF(t.theirShare)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {owesMe.length === 0 && iOwe.length === 0 && (
          <p className="text-zinc-600 text-sm text-center py-12">
            Noch keine geteilten Ausgaben erfasst.{"\n"}
            Scanne eine Quittung und wähle 50/50 oder Nur [Partner].
          </p>
        )}
      </div>
    </div>
  )
}
