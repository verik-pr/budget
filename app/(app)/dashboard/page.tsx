import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatCHF } from "@/lib/utils"
import { AccountSelector } from "@/components/account-selector"
import { TransactionList } from "@/components/transaction-list"
import { ForecastCard } from "@/components/forecast-card"
import { applyDueRecurringTransactions } from "@/lib/recurring"
import Link from "next/link"

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ konto?: string }> }) {
  const session = await getServerSession(authOptions)
  if (session) await applyDueRecurringTransactions()
  const { konto } = await searchParams

  const now = new Date()
  const periodStart = now.getDate() >= 24
    ? new Date(now.getFullYear(), now.getMonth(), 24)
    : new Date(now.getFullYear(), now.getMonth() - 1, 24)
  const start = periodStart
  const end = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 24)
  const lastStart = new Date(periodStart.getFullYear(), periodStart.getMonth() - 1, 24)

  const allAccounts = await prisma.account.findMany({ orderBy: { createdAt: "asc" } })

  // Only show the user's own personal account + shared accounts
  const firstName = session?.user?.name?.split(" ")[0] ?? ""
  const personalAccount = allAccounts.find(a =>
    a.type === "personal" && a.name.toLowerCase().includes(firstName.toLowerCase())
  )
  const visibleAccounts = allAccounts.filter(a =>
    a.type === "shared" || a.id === personalAccount?.id
  )
  const selectedId = konto ?? personalAccount?.id ?? visibleAccounts[0]?.id

  // When viewing personal account, also include transactions with no account assigned
  const isPersonal = selectedId === personalAccount?.id
  const accountFilter = isPersonal
    ? { OR: [{ accountId: selectedId }, { accountId: null }] }
    : { accountId: selectedId }

  const [transactions, lastMonth] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: start, lt: end }, ...accountFilter },
      include: { category: true, user: { select: { id: true, name: true, color: true } }, account: { select: { id: true, name: true, icon: true, color: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: lastStart, lt: start }, ...accountFilter },
      include: { category: true },
    }),
  ])

  const income = transactions.filter(t => t.category.type === "income").reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.category.type === "expense").reduce((s, t) => s + t.amount, 0)
  const balance = income - expenses

  const lastExpenses = lastMonth.filter(t => t.category.type === "expense").reduce((s, t) => s + t.amount, 0)
  const expenseDiff = lastExpenses !== 0 ? Math.round(((expenses - lastExpenses) / Math.abs(lastExpenses)) * 100) : null

  const endLabel = new Date(end.getTime() - 86400000)
  const monthLabel = `${start.getDate()}. ${start.toLocaleDateString("de-CH", { month: "short" })} – ${endLabel.getDate()}. ${endLabel.toLocaleDateString("de-CH", { month: "short", year: "numeric" })}`

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="ink-panel px-6 pt-safe pb-10 rounded-b-[32px]">
        <p className="kicker text-cream/40 mb-4">{monthLabel}</p>

        <AccountSelector accounts={visibleAccounts} selected={selectedId} />

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
              <p className={`text-xs mt-1 font-medium ${expenseDiff <= 0 ? "text-[#7fc89e]" : "text-[#e89890]"}`}>
                {expenseDiff >= 0 ? "+" : ""}{expenseDiff}% vs. Vormonat
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="stagger">
        <div className="px-6 pt-6">
          <ForecastCard accountId={selectedId ?? null} />
        </div>

        {/* Transactions */}
        <div className="px-6 pt-6">
          <div className="flex items-baseline justify-between mb-4">
            <p className="kicker text-muted">Letzte Buchungen</p>
            <Link href="/transactions" className="text-xs font-bold text-pine">Alle</Link>
          </div>

          {transactions.length === 0 ? (
            <p className="text-muted text-sm text-center py-12">Noch keine Buchungen diese Periode</p>
          ) : (
            <TransactionList transactions={transactions.slice(0, 12)} />
          )}
        </div>
      </div>
    </div>
  )
}
