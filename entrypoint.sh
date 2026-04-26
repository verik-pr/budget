#!/bin/sh
set -e

echo "→ Prisma DB push..."
npx prisma db push --skip-generate

echo "→ Seeding users..."
npx tsx prisma/seed.ts 2>/dev/null || true

echo "→ Starting server..."
npm start
