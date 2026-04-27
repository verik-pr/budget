"use client"

import { signOut } from "next-auth/react"

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full text-left px-5 py-4 text-sm font-semibold text-red-500"
    >
      Abmelden
    </button>
  )
}
