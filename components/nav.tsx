"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, List, Plus, BarChart2, Settings } from "lucide-react"
import clsx from "clsx"

const links = [
  { href: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { href: "/transactions", label: "Buchungen", icon: List },
  { href: "/transactions/new", label: "Neu", icon: Plus },
  { href: "/stats", label: "Statistik", icon: BarChart2 },
  { href: "/mehr", label: "Mehr", icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  if (pathname === "/scan") return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-2 nav-safe">
      <div className="max-w-lg mx-auto rounded-[26px] border border-rule bg-card/90 backdrop-blur-xl shadow-navbar">
        <div className="grid grid-cols-5 items-center">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (pathname.startsWith(href) && href !== "/dashboard" && href !== "/mehr")
            const isNew = href === "/transactions/new"

            if (isNew) {
              return (
                <Link key={href} href={href} aria-label="Neue Buchung"
                  className="flex justify-center">
                  <span className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-pine text-cream shadow-fab transition-transform active:scale-95">
                    <Plus className="h-6 w-6" strokeWidth={2.5} />
                  </span>
                </Link>
              )
            }

            return (
              <Link key={href} href={href}
                className={clsx(
                  "flex flex-col items-center gap-1 py-2.5 transition-colors",
                  active ? "text-ink" : "text-faint"
                )}>
                <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 1.6} />
                <span className={clsx("text-[10px] tracking-wide", active ? "font-bold" : "font-medium")}>{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
