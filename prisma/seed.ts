import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

function requiredEnv(name: string, fallback: string): string {
  const value = process.env[name]
  if (value) return value
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be set in production`)
  }
  return fallback
}

async function main() {
  const erikPassword = await bcrypt.hash(requiredEnv("ERIK_PASSWORD", "changeme"), 12)
  const celinePassword = await bcrypt.hash(requiredEnv("PARTNER_PASSWORD", "changeme"), 12)

  await prisma.user.upsert({
    where: { email: requiredEnv("ERIK_EMAIL", "erik@budget.local") },
    update: {},
    create: {
      name: requiredEnv("ERIK_NAME", "Erik"),
      email: requiredEnv("ERIK_EMAIL", "erik@budget.local"),
      password: erikPassword,
      color: "#6366f1",
    },
  })

  await prisma.user.upsert({
    where: { email: requiredEnv("PARTNER_EMAIL", "celine@budget.local") },
    update: {},
    create: {
      name: requiredEnv("PARTNER_NAME", "Céline"),
      email: requiredEnv("PARTNER_EMAIL", "celine@budget.local"),
      password: celinePassword,
      color: "#ec4899",
    },
  })

  const accounts = [
    { id: "konto_erik", name: "Eriks Konto", icon: "💙", color: "#6366f1", type: "personal" },
    { id: "konto_celine", name: "Célines Konto", icon: "💗", color: "#ec4899", type: "personal" },
    { id: "konto_gemeinsam", name: "Gemeinsames Konto", icon: "🤝", color: "#8b5cf6", type: "shared" },
  ]

  for (const acc of accounts) {
    await prisma.account.upsert({
      where: { id: acc.id },
      update: {},
      create: acc,
    })
  }

  const categories = [
    { name: "Lohn", icon: "💼", type: "income" },
    { name: "Sonstiges Einkommen", icon: "💰", type: "income" },
    { name: "Beitrag Familie", icon: "💝", type: "income" },
    { name: "Miete", icon: "🏠", type: "expense" },
    { name: "Baby & Kind", icon: "👶", type: "expense" },
    { name: "Haushalt", icon: "🧽", type: "expense" },
    { name: "Lebensmittel", icon: "🛒", type: "expense" },
    { name: "Restaurant", icon: "🍽️", type: "expense" },
    { name: "Transport", icon: "🚗", type: "expense" },
    { name: "Gesundheit", icon: "💊", type: "expense" },
    { name: "Freizeit", icon: "🎬", type: "expense" },
    { name: "Kleidung", icon: "👗", type: "expense" },
    { name: "Reisen", icon: "✈️", type: "expense" },
    { name: "Versicherung", icon: "🛡️", type: "expense" },
    { name: "Abonnements", icon: "📱", type: "expense" },
    { name: "Geschenke", icon: "🎁", type: "expense" },
    { name: "Sparen", icon: "🏦", type: "expense" },
    { name: "Sonstiges", icon: "📦", type: "expense" },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.name },
      update: {},
      create: { id: cat.name, name: cat.name, icon: cat.icon, type: cat.type },
    })
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
