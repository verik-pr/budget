import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const erikPassword = await bcrypt.hash(process.env.ERIK_PASSWORD || "changeme", 12)
  const celinePassword = await bcrypt.hash(process.env.PARTNER_PASSWORD || "changeme", 12)

  await prisma.user.upsert({
    where: { email: process.env.ERIK_EMAIL || "erik@budget.local" },
    update: {},
    create: {
      name: process.env.ERIK_NAME || "Erik",
      email: process.env.ERIK_EMAIL || "erik@budget.local",
      password: erikPassword,
      color: "#6366f1",
    },
  })

  await prisma.user.upsert({
    where: { email: process.env.PARTNER_EMAIL || "celine@budget.local" },
    update: {},
    create: {
      name: process.env.PARTNER_NAME || "Céline",
      email: process.env.PARTNER_EMAIL || "celine@budget.local",
      password: celinePassword,
      color: "#ec4899",
    },
  })

  const categories = [
    { name: "Lohn", icon: "💼", type: "income" },
    { name: "Sonstiges Einkommen", icon: "💰", type: "income" },
    { name: "Miete", icon: "🏠", type: "expense" },
    { name: "Lebensmittel", icon: "🛒", type: "expense" },
    { name: "Restaurant", icon: "🍽️", type: "expense" },
    { name: "Transport", icon: "🚗", type: "expense" },
    { name: "Gesundheit", icon: "💊", type: "expense" },
    { name: "Freizeit", icon: "🎬", type: "expense" },
    { name: "Kleidung", icon: "👗", type: "expense" },
    { name: "Reisen", icon: "✈️", type: "expense" },
    { name: "Versicherung", icon: "🛡️", type: "expense" },
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
