import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CONTRIBUTORS, expenseShares, formatCHF, maskPrivateTx } from "@/lib/utils"
import { getUpcomingPayments } from "@/lib/upcoming"
import { AccountSelector } from "@/components/account-selector"
import { TransactionList } from "@/components/transaction-list"
import { ForecastCard } from "@/components/forecast-card"
import { applyDueRecurringTransactions } from "@/lib/recurring"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ konto?: string; periode?: string }> }) {
  const session = await getServerSession(authOptions)
  if (session) await applyDueRecurringTransactions()
  const { konto, periode } = await searchParams

  const now = new Date()
  // Perioden laufen 24.–23.; identifiziert über den Monat, in dem sie enden.
  // ?periode=YYYY-MM blättert zurück (z.B. abgeschlossener Monat), Zukunft
  // wird auf die aktuelle Periode gedeckelt.
  const currentEndMonth = now.getDate() >= 24
    ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1)
  let endMonth = currentEndMonth
  const m = periode?.match(/^(\d{4})-(\d{2})$/)
  if (m) {
    const parsed = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, 1)
    if (!Number.isNaN(parsed.getTime()) && parsed < currentEndMonth) endMonth = parsed
  }
  const isCurrentPeriod = endMonth.getTime() === currentEndMonth.getTime()
  const start = new Date(endMonth.getFullYear(), endMonth.getMonth() - 1, 24)
  const end = new Date(endMonth.getFullYear(), endMonth.getMonth(), 24)
  const lastStart = new Date(endMonth.getFullYear(), endMonth.getMonth() - 2, 24)

  const periodHref = (d: Date) => {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    return `/dashboard?periode=${key}${konto ? `&konto=${konto}` : ""}`
  }
  const prevHref = periodHref(new Date(endMonth.getFullYear(), endMonth.getMonth() - 1, 1))
  const nextHref = periodHref(new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 1))

  const allAccounts = await prisma.account.findMany({ orderBy: { createdAt: "asc" } })

  // Full Disclosure: beide sehen alle persönlichen und gemeinsamen Konten;
  // das eigene ist nur das Standard-Konto
  const firstName = session?.user?.name?.split(" ")[0] ?? ""
  const personalAccount = allAccounts.find(a =>
    a.type === "personal" && a.name.toLowerCase().includes(firstName.toLowerCase())
  )
  const visibleAccounts = allAccounts.filter(a =>
    a.type === "shared" || a.type === "personal"
  )
  const selectedId = konto ?? personalAccount?.id ?? visibleAccounts[0]?.id

  // Beim eigenen persönlichen Konto auch Buchungen ohne Konto-Zuordnung zeigen
  const isPersonal = selectedId === personalAccount?.id
  const accountFilter = isPersonal
    ? { OR: [{ accountId: selectedId }, { accountId: null }] }
    : { accountId: selectedId }

  const [transactions, lastMonth, allPeriodExpenses] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: start, lt: end }, ...accountFilter },
      include: { category: true, user: { select: { id: true, name: true, color: true } }, account: { select: { id: true, name: true, icon: true, color: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: lastStart, lt: start }, ...accountFilter },
      include: { category: true },
    }),
    // Personen-Split: alle Ausgaben der Periode, unabhängig vom gewählten Konto
    prisma.transaction.findMany({
      where: { date: { gte: start, lt: end }, category: { type: "expense" } },
      include: { user: { select: { name: true } } },
    }),
  ])

  // Radar & Prognose sind zukunftsbezogen — nur in der aktuellen Periode
  const upcoming = isCurrentPeriod ? await getUpcomingPayments(now) : []
  const upcomingTotal = upcoming.reduce((s, u) => s + u.amount, 0)

  const income = transactions.filter(t => t.category.type === "income").reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.category.type === "expense").reduce((s, t) => s + t.amount, 0)
  const balance = income - expenses

  const lastExpenses = lastMonth.filter(t => t.category.type === "expense").reduce((s, t) => s + t.amount, 0)
  const expenseDiff = lastExpenses !== 0 ? Math.round(((expenses - lastExpenses) / Math.abs(lastExpenses)) * 100) : null

  // Wer hat was ausgegeben (effektiv, Splits anteilig verteilt)
  const personTotals = new Map<string, number>()
  for (const t of allPeriodExpenses) {
    for (const [person, amount] of expenseShares(t, "effektiv")) {
      personTotals.set(person, (personTotals.get(person) ?? 0) + amount)
    }
  }
  const personSplit = CONTRIBUTORS
    .filter(c => (personTotals.get(c.value) ?? 0) > 0.005)
    .map(c => ({ label: c.label.split(" ")[0], color: c.color, total: personTotals.get(c.value)! }))
  const personGrand = personSplit.reduce((s, p) => s + p.total, 0)

  const endLabel = new Date(end.getTime() - 86400000)
  const monthLabel = `${start.getDate()}. ${start.toLocaleDateString("de-CH", { month: "short" })} – ${endLabel.getDate()}. ${endLabel.toLocaleDateString("de-CH", { month: "short", year: "numeric" })}`

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="ink-panel px-6 pt-safe pb-10 rounded-b-[32px]">
        <div className="flex items-center justify-between mb-4">
          <Link href={prevHref} className="text-cream/40 hover:text-cream transition-colors -ml-1 p-1">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <p className="kicker text-cream/40">
            {monthLabel}
            {!isCurrentPeriod && <span className="text-cream/25"> · abgeschlossen</span>}
          </p>
          {isCurrentPeriod ? (
            <span className="w-6" />
          ) : (
            <Link href={nextHref} className="text-cream/40 hover:text-cream transition-colors -mr-1 p-1">
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        <AccountSelector accounts={visibleAccounts} selected={selectedId} periode={isCurrentPeriod ? undefined : periode} />

        <p className="amount text-cream text-[56px] leading-none">
          {formatCHF(balance)}
        </p>
        <p className="kicker text-cream/35 mt-3">Bilanz</p>

        <div className="flex gap-6 mt-8 border-t border-cream/10 pt-5">
          <div>
            <p className="kicker text-cream/40 mb-1.5">Einnahmen</p>
            <p className="amount text-[#7fc89e] text-xl">+{formatCHF(income)}</p>
          </div>
          <div className="w-px bg-cream/10" />
          <div>
            <p className="kicker text-cream/40 mb-1.5">Ausgaben</p>
            <p className="amount text-cream text-xl">−{formatCHF(expenses)}</p>
            {expenseDiff !== null && (
              <Link href="/stats?delta=1" className={`block text-xs mt-1 font-medium underline decoration-dotted underline-offset-2 ${expenseDiff <= 0 ? "text-[#7fc89e]" : "text-[#e89890]"}`}>
                {expenseDiff >= 0 ? "+" : ""}{expenseDiff}% vs. Vormonat
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="stagger">
        {/* Wer hat was ausgegeben */}
        {personSplit.length > 0 && (
          <div className="px-6 pt-6">
            <Link href="/stats?tab=personen"
              className="block bg-card border border-rule shadow-card rounded-3xl px-5 py-4 active:scale-[0.99] transition-transform">
              <div className="flex items-baseline justify-between mb-3">
                <p className="kicker text-muted">Wer hat was ausgegeben</p>
                <p className="text-xs font-bold text-pine">Details</p>
              </div>
              <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px] mb-3">
                {personSplit.map(p => (
                  <div key={p.label} className="h-full rounded-full"
                    style={{ width: `${personGrand > 0 ? (p.total / personGrand) * 100 : 0}%`, backgroundColor: p.color }} />
                ))}
              </div>
              <div className="flex gap-5">
                {personSplit.map(p => (
                  <div key={p.label} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-cream text-[9px] font-black flex-shrink-0"
                      style={{ backgroundColor: p.color }}>{p.label[0]}</div>
                    <div>
                      <p className="amount text-[14px] text-ink leading-none">{formatCHF(p.total)}</p>
                      <p className="text-[10px] text-muted mt-0.5">{p.label} · {personGrand > 0 ? Math.round((p.total / personGrand) * 100) : 0}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </Link>
          </div>
        )}

        {/* Radar: Demnächst fällig */}
        {upcoming.length > 0 && (
          <div className="px-6 pt-6">
            <Link href="/stats?tab=planung"
              className="block bg-card border border-rule shadow-card rounded-3xl px-5 py-4 active:scale-[0.99] transition-transform">
              <div className="flex items-baseline justify-between mb-3">
                <p className="kicker text-muted">Demnächst fällig</p>
                <p className="text-xs text-muted tabular-nums">30 Tage · <span className="font-bold text-ink">{formatCHF(upcomingTotal)}</span></p>
              </div>
              <div className="space-y-2.5">
                {upcoming.slice(0, 5).map((u, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-base w-6 text-center flex-shrink-0">{u.icon}</span>
                    <p className="text-sm font-semibold text-ink flex-1 truncate">{u.name}</p>
                    <p className="text-xs text-muted flex-shrink-0">
                      {u.date.toLocaleDateString("de-CH", { day: "numeric", month: "short" })}
                    </p>
                    <p className="amount text-[14px] text-ink flex-shrink-0 w-24 text-right">{formatCHF(u.amount)}</p>
                  </div>
                ))}
              </div>
              {upcoming.length > 5 && (
                <p className="text-xs font-bold text-pine mt-3">{upcoming.length - 5} weitere in der Planung</p>
              )}
            </Link>
          </div>
        )}

        {isCurrentPeriod && (
          <div className="px-6 pt-6">
            <ForecastCard accountId={selectedId ?? null} />
          </div>
        )}

        {/* Transactions */}
        <div className="px-6 pt-6">
          <div className="flex items-baseline justify-between mb-4">
            <p className="kicker text-muted">{isCurrentPeriod ? "Letzte Buchungen" : "Buchungen dieser Periode"}</p>
            <Link href="/transactions" className="text-xs font-bold text-pine">Alle</Link>
          </div>

          {transactions.length === 0 ? (
            <p className="text-muted text-sm text-center py-12">Keine Buchungen in dieser Periode</p>
          ) : (
            <TransactionList transactions={transactions.slice(0, 12).map(t => maskPrivateTx(t, session?.user?.id ?? ""))} />
          )}
        </div>
      </div>
    </div>
  )
}
