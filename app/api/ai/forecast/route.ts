import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { generateForecast } from "@/lib/ai"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get("accountId")

  try {
    const result = await generateForecast(accountId)
    return NextResponse.json(result)
  } catch (err) {
    console.error("forecast error", err)
    return NextResponse.json(null)
  }
}
