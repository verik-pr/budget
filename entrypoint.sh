#!/bin/sh
set -e

# Unique-Index idempotent VOR db push anlegen. Sonst will "prisma db push"
# den neuen @@unique([recurringId, date]) auf der bestehenden Transaction-
# Tabelle ergänzen und bricht ohne --accept-data-loss ab (Crash-Loop).
# So bleibt der Data-Loss-Schutz für echte destruktive Änderungen erhalten.
echo "→ Ensure unique indexes (idempotent)..."
echo 'CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_recurringId_date_key" ON "Transaction" ("recurringId", "date");' \
  | npx prisma db execute --schema=prisma/schema.prisma --stdin || true

echo "→ Prisma DB push..."
npx prisma db push --skip-generate

echo "→ Seeding users..."
npx tsx prisma/seed.ts 2>/dev/null || true

echo "→ Starting server..."
npm start
