import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { suggestCategory } from "@/lib/ai"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { description, type } = await req.json()
  if (typeof description !== "string" || (type !== "expense" && type !== "income")) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  try {
    const result = await suggestCategory(description, type)
    return NextResponse.json(result)
  } catch (err) {
    console.error("categorize error", err)
    return NextResponse.json(null)
  }
}
