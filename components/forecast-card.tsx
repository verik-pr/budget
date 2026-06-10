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
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    const params = accountId ? `?accountId=${accountId}` : ""
    fetch(`/api/ai/forecast${params}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(true)
        setLoading(false)
      })
    return () => controller.abort()
  }, [accountId])

  if (loading) {
    return (
      <div className="ink-panel rounded-3xl px-5 py-4 border border-ink/40">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-cream/70" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-7 w-32 mb-2" />
        <Skeleton className="h-3 w-full" />
      </div>
    )
  }

  if (error || !data) return null

  return (
    <div className="ink-panel rounded-3xl px-5 py-4 border border-ink/40">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-cream/70" />
        <p className="kicker text-cream/45">Prognose</p>
      </div>
      <p className="amount text-cream text-[26px] mb-1">{formatCHF(data.projected)}</p>
      <p className="text-cream/50 text-xs leading-snug">{data.message}</p>
    </div>
  )
}
