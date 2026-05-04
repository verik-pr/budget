import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function auth(req: NextRequest) {
  const key = process.env.AGENT_API_KEY
  if (!key) return false
  return req.headers.get("authorization") === `Bearer ${key}`
}

// POST /api/agent/setup — upsert a category
// Body: { name, icon, type }
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, icon, type } = await req.json()
  if (!name || !icon || !type) return NextResponse.json({ error: "name, icon, type required" }, { status: 400 })

  const category = await prisma.category.upsert({
    where: { id: name },
    update: { icon, type },
    create: { id: name, name, icon, type },
  })

  return NextResponse.json({ ok: true, category }, { status: 201 })
}
