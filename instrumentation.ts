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
      `ALTER TABLE "Category" ADD COLUMN "budget" REAL`,
      `CREATE TABLE IF NOT EXISTS "Provision" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "icon" TEXT NOT NULL DEFAULT '📅',
        "totalAmount" REAL NOT NULL,
        "frequencyMonths" INTEGER NOT NULL DEFAULT 12,
        "nextDueDate" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS "PushSubscription" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "endpoint" TEXT NOT NULL UNIQUE,
        "p256dh" TEXT NOT NULL,
        "auth" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS "NotificationPrefs" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL UNIQUE,
        "budgetWarning" INTEGER NOT NULL DEFAULT 1,
        "creditCardDue" INTEGER NOT NULL DEFAULT 1,
        "partnerBooking" INTEGER NOT NULL DEFAULT 1,
        "turnNudge" INTEGER NOT NULL DEFAULT 1,
        "goalReached" INTEGER NOT NULL DEFAULT 1,
        "scanReminder" INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS "BudgetAlertSent" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL,
        "threshold" INTEGER NOT NULL,
        "periodStart" DATETIME NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
        FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "BudgetAlertSent_unique" ON "BudgetAlertSent" ("userId", "categoryId", "threshold", "periodStart")`,
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
