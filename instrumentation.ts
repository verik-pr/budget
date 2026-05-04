export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prisma } = await import("./lib/prisma")
    // Add new columns if they don't exist yet (SQLite doesn't support IF NOT EXISTS)
    const migrations = [
      `ALTER TABLE "Transaction" ADD COLUMN "sharedWith" TEXT`,
      `ALTER TABLE "Transaction" ADD COLUMN "sharedRatio" REAL`,
      `ALTER TABLE "Transaction" ADD COLUMN "note" TEXT`,
      `ALTER TABLE "Transaction" ADD COLUMN "receiptId" TEXT`,
      `ALTER TABLE "Transaction" ADD COLUMN "receiptMerchant" TEXT`,
      `ALTER TABLE "Account" ADD COLUMN "dueDay" INTEGER`,
      `ALTER TABLE "Account" ADD COLUMN "ownerName" TEXT`,
      `CREATE TABLE IF NOT EXISTS "Provision" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "icon" TEXT NOT NULL DEFAULT '📅',
        "totalAmount" REAL NOT NULL,
        "frequencyMonths" INTEGER NOT NULL DEFAULT 12,
        "nextDueDate" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
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
