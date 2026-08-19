"use client"

import { useRouter } from "next/navigation"

type Account = { id: string; name: string; icon: string; color: string }

export function AccountSelector({ accounts, selected, periode }: { accounts: Account[]; selected: string; periode?: string }) {
  const router = useRouter()

  return (
    <div className="flex gap-2 flex-wrap mb-6">
      {accounts.map(acc => (
        <button
          key={acc.id}
          onClick={() => router.push(`/dashboard?konto=${acc.id}${periode ? `&periode=${periode}` : ""}`)}
          style={selected === acc.id ? { backgroundColor: acc.color } : {}}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-[0.97] ${
            selected === acc.id ? "text-cream shadow-md" : "bg-cream/10 text-cream/55 border border-cream/15"
          }`}>
          <span>{acc.icon}</span>
          <span>{acc.name}</span>
        </button>
      ))}
    </div>
  )
}
