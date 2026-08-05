import { prisma } from "./prisma"
import { CONTRIBUTORS, contributorFromName } from "./utils"

export type DebtData = Awaited<ReturnType<typeof getDebtData>>

// Gemeinsam-Saldo zwischen Erik und Céline aus Sicht des eingeloggten Users.
// net > 0 heisst: der Partner schuldet mir.
export async function getDebtData(sessionUserName: string) {
  const myValue = contributorFromName(sessionUserName)
  const partnerValue = myValue === "erik" ? "celine" : "erik"
  const partner = CONTRIBUTORS.find(c => c.value === partnerValue)!
  const mine = CONTRIBUTORS.find(c => c.value === myValue)!

  const all = await prisma.transaction.findMany({
    where: {
      OR: [
        { contributor: myValue, sharedWith: partnerValue },
        { contributor: partnerValue, sharedWith: myValue },
      ],
    },
    include: { category: true },
    orderBy: { date: "desc" },
  })

  const partnerOwesMe = all
    .filter(t => t.contributor === myValue && t.sharedWith === partnerValue)
    .reduce((s, t) => s + t.amount * (t.sharedRatio ?? 0), 0)

  const iOwePartner = all
    .filter(t => t.contributor === partnerValue && t.sharedWith === myValue)
    .reduce((s, t) => s + t.amount * (t.sharedRatio ?? 0), 0)

  const net = partnerOwesMe - iOwePartner

  return {
    net,
    partnerOwesMe,
    iOwePartner,
    partnerLabel: partner.label,
    partnerColor: partner.color,
    myLabel: mine.label,
    transactions: all.map(t => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      description: t.description,
      category: t.category,
      contributor: t.contributor,
      sharedWith: t.sharedWith,
      sharedRatio: t.sharedRatio,
      theirShare: t.amount * (t.sharedRatio ?? 0),
      direction: t.contributor === myValue ? "owesMe" : "iOwe",
    })),
  }
}
