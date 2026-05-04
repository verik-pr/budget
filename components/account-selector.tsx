"use client"

import { useRouter } from "next/navigation"

type Account = { id: string; name: string; icon: string; color: string }

export function AccountSelector({ accounts, selected }: { accounts: Account[]; selected: string }) {
  const router = useRouter()

  return (
    <div className="flex gap-2 flex-wrap mb-6">
      {accounts.map(acc => (
        <button
          key={acc.id}
          onClick={() => router.push(`/dashboard?konto=${acc.id}`)}
          style={selected === acc.id ? { backgroundColor: acc.color } : {}}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            selected === acc.id ? "text-white" : "bg-zinc-800 text-zinc-400"
          }`}>
          <span>{acc.icon}</span>
          <span>{acc.name}</span>
        </button>
      ))}
    </div>
  )
}
