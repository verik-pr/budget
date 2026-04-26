"use client"

import { signOut } from "next-auth/react"

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full text-left px-4 py-3.5 text-sm font-medium text-red-500"
    >
      Abmelden
    </button>
  )
}
