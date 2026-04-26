"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, List, PlusCircle, Settings } from "lucide-react"
import clsx from "clsx"

const links = [
  { href: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { href: "/transactions", label: "Buchungen", icon: List },
  { href: "/transactions/new", label: "Neu", icon: PlusCircle },
  { href: "/mehr", label: "Mehr", icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-pb z-50">
      <div className="grid grid-cols-4 max-w-lg mx-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href) && href !== "/mehr")
          const isNew = href === "/transactions/new"
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center gap-0.5 py-2 px-1 text-xs font-medium transition-colors",
                isNew
                  ? "text-green-600"
                  : active
                  ? "text-green-600"
                  : "text-gray-400"
              )}
            >
              <Icon className={clsx("w-6 h-6", isNew && "w-7 h-7")} strokeWidth={isNew ? 1.5 : active ? 2 : 1.5} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
