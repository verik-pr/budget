import { prisma } from "./prisma"
import { sendPush } from "./push"
import { formatCHF, CONTRIBUTORS } from "./utils"

function periodStartFor(date: Date): Date {
  return date.getDate() >= 24
    ? new Date(date.getFullYear(), date.getMonth(), 24)
    : new Date(date.getFullYear(), date.getMonth() - 1, 24)
}

export async function checkBudgetThresholds(_bookingUserId: string, categoryId: string, txDate: Date) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } })
  if (!category?.budget || category.budget <= 0 || category.type !== "expense") return

  const periodStart = periodStartFor(txDate)
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 24)

  const sum = await prisma.transaction.aggregate({
    where: { categoryId, date: { gte: periodStart, lt: periodEnd } },
    _sum: { amount: true },
  })
  const spent = sum._sum.amount ?? 0
  const pct = (spent / category.budget) * 100

  const thresholds: number[] = []
  if (pct >= 100) thresholds.push(100)
  else if (pct >= 80) thresholds.push(80)
  if (thresholds.length === 0) return

  // Budgets sind gemeinsam — beide informieren, nicht nur wer gerade gebucht hat.
  // BudgetAlertSent ist pro User unique je (Kategorie, Schwelle, Periode).
  const users = await prisma.user.findMany({ select: { id: true } })

  for (const threshold of thresholds) {
    for (const user of users) {
      try {
        await prisma.budgetAlertSent.create({
          data: { userId: user.id, categoryId, threshold, periodStart },
        })
      } catch {
        continue
      }
      const isOver = threshold === 100
      await sendPush(user.id, "budgetWarning", {
        title: isOver ? `${category.icon} ${category.name}: Budget überschritten` : `${category.icon} ${category.name}: 80% erreicht`,
        body: `${formatCHF(spent)} von ${formatCHF(category.budget)} ausgegeben`,
        url: "/budgets",
        tag: `budget-${categoryId}-${threshold}`,
      })
    }
  }
}

export async function notifyPartnerOfBooking(payerUserId: string, sharedWith: string, amount: number, description: string | null, categoryName: string) {
  const targetContrib = CONTRIBUTORS.find(c => c.value === sharedWith)
  if (!targetContrib) return

  const partner = await prisma.user.findFirst({
    where: {
      name: { contains: targetContrib.label.split(" ")[0] },
      id: { not: payerUserId },
    },
  })
  if (!partner) return

  const payer = await prisma.user.findUnique({ where: { id: payerUserId } })
  const payerName = payer?.name?.split(" ")[0] ?? "Partner"

  await sendPush(partner.id, "partnerBooking", {
    title: `${payerName} hat gebucht`,
    body: `${description ?? categoryName} · ${formatCHF(amount)}`,
    url: "/transactions",
    tag: `partner-${payerUserId}-${Date.now()}`,
  })
}

export async function notifyGoalReached(userId: string, goalName: string, icon: string) {
  await sendPush(userId, "goalReached", {
    title: `${icon} Sparziel erreicht!`,
    body: `${goalName} ist zu 100% erreicht 🎉`,
    url: "/goals",
    tag: `goal-${userId}-${goalName}`,
  })
}
