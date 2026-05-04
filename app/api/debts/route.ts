import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { CONTRIBUTORS } from "@/lib/utils"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const firstName = session.user.name?.split(" ")[0]?.toLowerCase() ?? ""
  const myContrib = CONTRIBUTORS.find(c => c.label.toLowerCase().startsWith(firstName))
  const myValue = myContrib?.value ?? "erik"
  const partnerValue = myValue === "erik" ? "celine" : "erik"
  const partner = CONTRIBUTORS.find(c => c.value === partnerValue)!

  // All split transactions between these two people
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

  // Partner owes me = I paid, they owe their share
  const partnerOwesMe = all
    .filter(t => t.contributor === myValue && t.sharedWith === partnerValue)
    .reduce((s, t) => s + t.amount * (t.sharedRatio ?? 0), 0)

  // I owe partner = they paid, I owe my share
  const iOwePartner = all
    .filter(t => t.contributor === partnerValue && t.sharedWith === myValue)
    .reduce((s, t) => s + t.amount * (t.sharedRatio ?? 0), 0)

  const net = partnerOwesMe - iOwePartner // positive = partner owes me

  const transactions = all.map(t => ({
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
  }))

  return NextResponse.json({
    net,
    partnerOwesMe,
    iOwePartner,
    partnerLabel: partner.label,
    partnerColor: partner.color,
    myLabel: myContrib?.label ?? "Ich",
    transactions,
  })
}
