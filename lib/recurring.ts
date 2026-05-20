import { prisma } from "./prisma"

function periodBounds(now: Date) {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  }
}

function dueDateForMonth(now: Date, dayOfMonth: number) {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return new Date(now.getFullYear(), now.getMonth(), Math.min(dayOfMonth, lastDay))
}

export async function applyDueRecurringTransactions(now = new Date()) {
  const { start, end } = periodBounds(now)
  const rules = await prisma.recurringTransaction.findMany({ where: { active: true } })

  for (const rule of rules) {
    const dueDate = dueDateForMonth(now, rule.dayOfMonth)
    if (dueDate > now) continue

    await prisma.$transaction(async tx => {
      const alreadyInMonth = await tx.transaction.findFirst({
        where: { recurringId: rule.id, date: { gte: start, lt: end } },
        select: { id: true },
      })
      if (alreadyInMonth) return

      await tx.transaction.upsert({
        where: { recurringId_date: { recurringId: rule.id, date: dueDate } },
        update: {},
        create: {
          date: dueDate,
          amount: rule.amount,
          description: rule.name,
          categoryId: rule.categoryId,
          userId: rule.userId,
          recurringId: rule.id,
        },
      })
    })
  }
}
