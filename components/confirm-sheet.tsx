"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider")
  return ctx
}

type State = { opts: ConfirmOptions; resolve: (v: boolean) => void } | null

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(null)

  const confirm = useCallback<ConfirmFn>(opts => {
    return new Promise<boolean>(resolve => setState({ opts, resolve }))
  }, [])

  const close = (v: boolean) => {
    state?.resolve(v)
    setState(null)
  }

  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-ink/50 sheet-backdrop" onClick={() => close(false)} />
          <div className="relative w-full max-w-lg ink-panel rounded-t-[28px] pb-safe sheet-panel">
            <div className="w-10 h-1 bg-cream/25 rounded-full mx-auto mt-3" />
            <div className="px-6 pt-5 pb-5 text-center">
              <p className="display text-cream text-xl">{state.opts.title}</p>
              {state.opts.description && (
                <p className="text-cream/60 text-sm mt-2">{state.opts.description}</p>
              )}
            </div>
            <div className="px-4 space-y-2">
              <button
                onClick={() => close(true)}
                className={`w-full rounded-2xl py-3.5 text-base font-bold active:opacity-80 ${
                  state.opts.destructive ? "bg-blood text-cream" : "bg-cream text-ink"
                }`}>
                {state.opts.confirmLabel ?? "Bestätigen"}
              </button>
              <button
                onClick={() => close(false)}
                className="w-full rounded-2xl py-3.5 text-base font-semibold bg-cream/10 text-cream/80 active:opacity-80">
                {state.opts.cancelLabel ?? "Abbrechen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
