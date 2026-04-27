"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await signIn("credentials", { email, password, redirect: false })
    if (res?.ok) {
      router.push("/dashboard")
    } else {
      setError("E-Mail oder Passwort falsch.")
      setLoading(false)
    }
  }

  return (
    <div className="login-root flex flex-col justify-end sm:justify-center sm:items-center">
      <div className="w-full sm:max-w-sm">
        <div className="px-8 pb-10 pt-16 sm:pt-0">
          <p className="text-green-400 text-xs font-semibold tracking-widest uppercase mb-2">Budget</p>
          <h1 className="text-white text-4xl font-black tracking-tight mb-1">Anmelden</h1>
          <p className="text-zinc-500 text-sm mb-10">Euer gemeinsames Budget</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">E-Mail</label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-green-500 transition-colors placeholder-zinc-700"
                placeholder="deine@email.ch"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Passwort</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} required autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3.5 pr-11 text-white text-sm focus:outline-none focus:border-green-500 transition-colors placeholder-zinc-700"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 p-1">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-green-500 hover:bg-green-400 text-black rounded-2xl py-4 font-black text-sm disabled:opacity-50 active:scale-[0.98] transition-all mt-2">
              {loading ? "…" : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
