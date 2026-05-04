"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, List, PlusCircle, BarChart2, Settings } from "lucide-react"
import clsx from "clsx"

const links = [
  { href: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { href: "/transactions", label: "Buchungen", icon: List },
  { href: "/transactions/new", label: "Neu", icon: PlusCircle },
  { href: "/stats", label: "Statistik", icon: BarChart2 },
  { href: "/mehr", label: "Mehr", icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  if (pathname === "/scan") return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 nav-safe">
      <div className="grid grid-cols-5 max-w-lg mx-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (pathname.startsWith(href) && href !== "/dashboard" && href !== "/mehr")
          const isNew = href === "/transactions/new"
          return (
            <Link key={href} href={href}
              className={clsx(
                "flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors",
                isNew ? "text-green-500" : active ? "text-black" : "text-gray-300"
              )}>
              <Icon className="w-5 h-5" strokeWidth={active || isNew ? 2.5 : 1.5} />
              <span className="text-[10px]">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
