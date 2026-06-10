"use client"

import { signIn } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await signIn("credentials", { email, password, redirect: false })
    if (res?.ok) {
      router.push("/dashboard")
    } else {
      setCooldown(5)
      setError("E-Mail oder Passwort falsch. Nach mehreren Fehlversuchen wird der Login kurz gesperrt.")
      setLoading(false)
    }
  }

  return (
    <div className="login-root ink-panel flex flex-col justify-end sm:justify-center sm:items-center">
      <div className="w-full sm:max-w-sm">
        <div className="stagger px-8 pb-10 pt-16 sm:pt-0">
          <p className="kicker text-cream/45 mb-3 flex items-center gap-2">
            <span className="inline-block h-px w-5 bg-cream/30" />
            Gemeinsames Budget
          </p>
          <h1 className="display text-cream text-[52px] leading-none mb-2">Budget</h1>
          <p className="text-cream/45 text-sm mb-10 italic font-serif">Jeder Franken im Buch.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="kicker block text-cream/45 mb-2">E-Mail</label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-cream/[0.06] border border-cream/15 rounded-2xl px-4 py-3.5 text-cream text-sm focus:outline-none focus:border-cream/40 transition-colors placeholder:text-cream/25"
                placeholder="deine@email.ch"
              />
            </div>

            <div>
              <label className="kicker block text-cream/45 mb-2">Passwort</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} required autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-cream/[0.06] border border-cream/15 rounded-2xl px-4 py-3.5 pr-11 text-cream text-sm focus:outline-none focus:border-cream/40 transition-colors placeholder:text-cream/25"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/35 hover:text-cream/60 p-1">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-[#e89890] text-sm font-medium">{error}</p>}

            <button type="submit" disabled={loading || cooldown > 0}
              className="w-full bg-cream hover:bg-white text-ink rounded-2xl py-4 font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-all mt-2">
              {loading ? "…" : cooldown > 0 ? `Warten (${cooldown}s)` : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
