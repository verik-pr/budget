"use client"

import { useEffect } from "react"
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="max-w-lg mx-auto min-h-screen flex items-center justify-center px-6">
      <div className="bg-card border border-rule shadow-card rounded-3xl px-6 py-8 w-full text-center">
        <div className="w-14 h-14 rounded-full bg-blood/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-blood" />
        </div>
        <p className="display text-ink text-xl mb-1">Etwas ist schief gelaufen</p>
        <p className="text-muted text-sm mb-6">
          {error.message || "Unerwarteter Fehler. Versuch es nochmal."}
        </p>
        <div className="flex gap-2">
          <button onClick={() => router.back()}
            className="flex-1 bg-paper border border-rule text-inkSoft rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-2 active:opacity-70">
            <ArrowLeft className="w-4 h-4" />Zurück
          </button>
          <button onClick={() => reset()}
            className="flex-1 bg-pine text-cream rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-2 active:opacity-70">
            <RefreshCw className="w-4 h-4" />Erneut
          </button>
        </div>
        {error.digest && (
          <p className="text-faint text-xs mt-4 font-mono">#{error.digest}</p>
        )}
      </div>
    </div>
  )
}
