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
      <div className="bg-zinc-900 rounded-3xl px-6 py-8 w-full text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-white text-lg font-black mb-1">Etwas ist schief gelaufen</p>
        <p className="text-zinc-500 text-sm mb-6">
          {error.message || "Unerwarteter Fehler. Versuch es nochmal."}
        </p>
        <div className="flex gap-2">
          <button onClick={() => router.back()}
            className="flex-1 bg-zinc-800 text-zinc-300 rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-2 active:opacity-70">
            <ArrowLeft className="w-4 h-4" />Zurück
          </button>
          <button onClick={() => reset()}
            className="flex-1 bg-green-500 text-black rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-2 active:opacity-70">
            <RefreshCw className="w-4 h-4" />Erneut
          </button>
        </div>
        {error.digest && (
          <p className="text-zinc-700 text-xs mt-4 font-mono">#{error.digest}</p>
        )}
      </div>
    </div>
  )
}
