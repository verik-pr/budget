import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const auth = req.headers.get("Authorization")
  if (auth !== `Bearer ${process.env.AGENT_API_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: Record<string, string> = {}
  const migrations = [
    `ALTER TABLE "Transaction" ADD COLUMN "sharedWith" TEXT`,
    `ALTER TABLE "Transaction" ADD COLUMN "sharedRatio" REAL`,
  ]

  for (const sql of migrations) {
    try {
      await prisma.$executeRawUnsafe(sql)
      results[sql] = "ok"
    } catch (e: unknown) {
      results[sql] = e instanceof Error ? e.message : "error"
    }
  }

  return NextResponse.json({ results })
}
