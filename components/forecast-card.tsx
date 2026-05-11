"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { formatCHF } from "@/lib/utils"
import { Skeleton } from "@/components/skeleton"

export function ForecastCard({ accountId }: { accountId: string | null }) {
  const [data, setData] = useState<{ projected: number; message: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const params = accountId ? `?accountId=${accountId}` : ""
    fetch(`/api/ai/forecast${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [accountId])

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-green-500" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-7 w-32 mb-2" />
        <Skeleton className="h-3 w-full" />
      </div>
    )
  }

  if (error || !data) return null

  return (
    <div className="bg-zinc-900 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-green-500" />
        <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">Prognose</p>
      </div>
      <p className="text-white text-2xl font-black tabular-nums mb-1">{formatCHF(data.projected)}</p>
      <p className="text-zinc-500 text-xs leading-snug">{data.message}</p>
    </div>
  )
}
