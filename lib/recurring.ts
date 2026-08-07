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

function periodKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export async function applyDueRecurringTransactions(now = new Date()) {
  const rules = await prisma.recurringTransaction.findMany({ where: { active: true } })

  for (const rule of rules) {
    // Aktueller Monat plus max. 2 verpasste Monate nachholen (falls die App
    // einen Monat lang nicht geöffnet wurde). lastAppliedPeriod verhindert,
    // dass gelöschte oder umdatierte Buchungen wieder auferstehen.
    // Ohne lastAppliedPeriod (Bestandsregeln direkt nach dem Deploy) NICHT
    // rückwirkend auffüllen — sonst erstehen bewusst gelöschte/umdatierte
    // Alt-Buchungen der Vormonate einmalig wieder auf.
    const offsets = rule.lastAppliedPeriod ? [-2, -1, 0] : [0]
    for (const offset of offsets) {
      const monthRef = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const periodKey = periodKeyOf(monthRef)
      if (rule.lastAppliedPeriod && rule.lastAppliedPeriod >= periodKey) continue
      if (rule.createdAt > new Date(monthRef.getFullYear(), monthRef.getMonth() + 1, 1)) continue

      const dueDate = dueDateForMonth(monthRef, rule.dayOfMonth)
      if (dueDate > now) continue

      await prisma.$transaction(async tx => {
        const { start, end } = periodBounds(monthRef)
        const alreadyInMonth = await tx.transaction.findFirst({
          where: { recurringId: rule.id, date: { gte: start, lt: end } },
          select: { id: true },
        })
        if (!alreadyInMonth) {
          await tx.transaction.upsert({
            where: { recurringId_date: { recurringId: rule.id, date: dueDate } },
            update: {},
            create: {
              date: dueDate,
              amount: rule.amount,
              description: rule.name,
              categoryId: rule.categoryId,
              userId: rule.userId,
              accountId: rule.accountId,
              recurringId: rule.id,
            },
          })
        }
        await tx.recurringTransaction.update({
          where: { id: rule.id },
          data: { lastAppliedPeriod: periodKey },
        })
      })
    }
  }
}
