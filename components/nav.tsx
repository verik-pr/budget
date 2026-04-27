"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, List, PlusCircle, RefreshCw, Settings } from "lucide-react"
import clsx from "clsx"

const links = [
  { href: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { href: "/transactions", label: "Buchungen", icon: List },
  { href: "/transactions/new", label: "Neu", icon: PlusCircle },
  { href: "/recurring", label: "Regeln", icon: RefreshCw },
  { href: "/mehr", label: "Mehr", icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
      <div className="grid grid-cols-5 max-w-lg mx-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (pathname.startsWith(href) && href !== "/dashboard" && href !== "/mehr")
          const isNew = href === "/transactions/new"
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center gap-0.5 py-2 px-1 text-xs font-medium transition-colors",
                isNew ? "text-green-600" : active ? "text-green-600" : "text-gray-400"
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={isNew || active ? 2 : 1.5} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
