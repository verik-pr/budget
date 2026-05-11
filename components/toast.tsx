"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { Check, AlertCircle, Info } from "lucide-react"

type ToastType = "success" | "error" | "info"
type ToastItem = { id: string; type: ToastType; message: string; leaving?: boolean }

type ToastFn = (message: string, type?: ToastType) => void

const ToastContext = createContext<ToastFn | null>(null)

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside ToastProvider")
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const show = useCallback<ToastFn>((message, type = "success") => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 240)
    }, 2500)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed top-safe inset-x-0 z-[60] flex flex-col items-center gap-2 pointer-events-none px-4">
        {toasts.map(t => (
          <div key={t.id}
            className={`toast-panel ${t.leaving ? "leaving" : ""} pointer-events-auto max-w-sm w-full px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 ${
              t.type === "error" ? "bg-red-500 text-white" :
              t.type === "info" ? "bg-zinc-900 text-white" :
              "bg-green-500 text-black"
            }`}>
            {t.type === "success" && <Check className="w-4 h-4 flex-shrink-0" strokeWidth={3} />}
            {t.type === "error" && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {t.type === "info" && <Info className="w-4 h-4 flex-shrink-0" />}
            <p className="text-sm font-bold flex-1">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
