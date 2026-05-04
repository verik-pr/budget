import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatCHF, formatDate, getContributorLabel } from "@/lib/utils"
import { AccountSelector } from "@/components/account-selector"
import Link from "next/link"

async function applyRecurring() {
  const now = new Date()
  const today = now.getDate()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const rules = await prisma.recurringTransaction.findMany({ where: { active: true } })
  for (const rule of rules) {
    if (rule.dayOfMonth > today) continue
    const already = await prisma.transaction.findFirst({
      where: { recurringId: rule.id, date: { gte: start, lt: end } },
    })
    if (already) continue
    await prisma.transaction.create({
      data: {
        date: new Date(now.getFullYear(), now.getMonth(), rule.dayOfMonth),
        amount: rule.amount,
        description: rule.name,
        categoryId: rule.categoryId,
        userId: rule.userId,
        recurringId: rule.id,
      },
    })
  }
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ konto?: string }> }) {
  await applyRecurring()

  const session = await getServerSession(authOptions)
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
      <div className="bg-black px-6 pt-safe pb-10">
        <p className="text-zinc-500 text-xs font-semibold tracking-widest uppercase mb-4">{monthLabel}</p>

        <AccountSelector accounts={visibleAccounts} selected={selectedId} />

        <p className="text-white text-5xl font-black tracking-tight tabular-nums">
          {formatCHF(balance)}
        </p>
        <p className="text-zinc-600 text-sm mt-2">Bilanz</p>

        <div className="flex gap-6 mt-8">
          <div>
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">Einnahmen</p>
            <p className="text-green-400 text-xl font-bold tabular-nums">+{formatCHF(income)}</p>
          </div>
          <div className="w-px bg-zinc-800" />
          <div>
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">Ausgaben</p>
            <p className="text-white text-xl font-bold tabular-nums">−{formatCHF(expenses)}</p>
            {expenseDiff !== null && (
              <p className={`text-xs mt-0.5 font-medium ${expenseDiff <= 0 ? "text-green-500" : "text-red-400"}`}>
                {expenseDiff >= 0 ? "+" : ""}{expenseDiff}% vs. Vormonat
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Letzte Buchungen</p>
          <Link href="/transactions" className="text-xs font-semibold text-green-500">Alle</Link>
        </div>

        {transactions.length === 0 ? (
          <p className="text-zinc-500 text-sm py-8 text-center">Noch keine Buchungen diesen Monat</p>
        ) : (
          <div className="bg-white rounded-3xl overflow-hidden">
            {transactions.slice(0, 8).map((t, i) => (
              <div key={t.id} className={`flex items-center gap-4 px-5 py-4 ${i < Math.min(transactions.length, 8) - 1 ? "border-b border-gray-100" : ""}`}>
                <span className="text-2xl w-8 text-center">{t.category.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {t.description || t.category.name}
                    {t.recurringId && <span className="text-gray-300 ml-1 font-normal">↻</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(t.date)} · {getContributorLabel(t.contributor, t.user.name)}
                    {t.account && <span style={{ color: t.account.color }}> · {t.account.icon} {t.account.name}</span>}
                  </p>
                </div>
                <p className={`text-sm font-bold tabular-nums ${t.category.type === "income" ? "text-green-500" : "text-gray-900"}`}>
                  {t.category.type === "income" ? "+" : "−"}{formatCHF(t.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
