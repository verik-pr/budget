export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prisma } = await import("./lib/prisma")
    // Add new columns if they don't exist yet (SQLite doesn't support IF NOT EXISTS)
    const migrations = [
      `ALTER TABLE "Transaction" ADD COLUMN "sharedWith" TEXT`,
      `ALTER TABLE "Transaction" ADD COLUMN "sharedRatio" REAL`,
    ]
    for (const sql of migrations) {
      try {
        await prisma.$executeRawUnsafe(sql)
      } catch {
        // Column already exists — safe to ignore
      }
    }
  }
}
