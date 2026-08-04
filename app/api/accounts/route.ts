import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { asIntegerInRange, asNonEmptyString, asNullableString } from "@/lib/api-validation"

const ACCOUNT_TYPES = new Set(["personal", "shared", "credit"])

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mine = searchParams.get("mine") === "true"

  const accounts = await prisma.account.findMany({ orderBy: { createdAt: "asc" } })

  if (mine) {
    const firstName = session.user.name?.split(" ")[0]?.toLowerCase() ?? ""
    const personal = accounts.find(a => a.type === "personal" && a.name.toLowerCase().includes(firstName))
    // credit-Konten mitliefern: der Planung-Tab zeigt Kreditkarten-Salden daraus
    const visible = accounts.filter(a => a.type === "shared" || a.type === "credit" || a.id === personal?.id)
    const defaultId = personal?.id ?? visible.find(a => a.type !== "credit")?.id ?? null
    return NextResponse.json({ accounts: visible, defaultId })
  }

  return NextResponse.json(accounts)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name, icon, color, type, dueDay, ownerName } = await req.json()
  const parsedName = asNonEmptyString(name)
  const parsedDueDay = dueDay === null || dueDay === undefined || dueDay === "" ? null : asIntegerInRange(dueDay, 1, 31)
  if (!parsedName || !ACCOUNT_TYPES.has(type) || parsedDueDay === null && dueDay !== null && dueDay !== undefined && dueDay !== "") {
    return NextResponse.json({ error: "Ungültige Felder" }, { status: 400 })
  }
  const account = await prisma.account.create({
    data: {
      name: parsedName,
      icon: asNullableString(icon) || "💳",
      color: asNullableString(color) || "#6366f1",
      type,
      dueDay: parsedDueDay,
      ownerName: asNullableString(ownerName),
    },
  })
  return NextResponse.json(account)
}
