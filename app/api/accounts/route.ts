import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mine = searchParams.get("mine") === "true"

  const accounts = await prisma.account.findMany({ orderBy: { createdAt: "asc" } })

  if (mine) {
    const firstName = session.user.name?.split(" ")[0]?.toLowerCase() ?? ""
    const personal = accounts.find(a => a.type === "personal" && a.name.toLowerCase().includes(firstName))
    const visible = accounts.filter(a => a.type === "shared" || a.id === personal?.id)
    return NextResponse.json({ accounts: visible, defaultId: personal?.id ?? visible[0]?.id ?? null })
  }

  return NextResponse.json(accounts)
}
