import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY nicht konfiguriert" }, { status: 503 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Kein Bild" }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString("base64")
  const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif"

  const categories = await prisma.category.findMany()
  const categoryNames = categories.map(c => c.name).join(", ")
  const today = new Date().toISOString().split("T")[0]

  const client = new Anthropic({ apiKey })

  let text: string
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `Analysiere diese Quittung und extrahiere alle Positionen mit Preisen.

Antworte NUR mit validem JSON, kein anderer Text:
{
  "merchant": "Name des Geschäfts oder Unbekannt",
  "date": "YYYY-MM-DD",
  "items": [
    { "name": "Artikelname", "amount": 12.50, "category": "Kategoriename" }
  ]
}

Verfügbare Kategorien: ${categoryNames}

Regeln:
- Datum: falls nicht lesbar, nimm ${today}
- Beträge: immer positiv, 2 Dezimalstellen
- Wähle die passendste verfügbare Kategorie
- Erfasse jeden einzelnen Posten separat
- Keine Rabatte oder Zwischensummen als separate Posten`,
          },
        ],
      }],
    })
    text = response.content[0].type === "text" ? response.content[0].text : ""
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler"
    return NextResponse.json({ error: `KI-Fehler: ${msg.slice(0, 120)}` }, { status: 502 })
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: "Quittung konnte nicht gelesen werden" }, { status: 422 })

  let parsed: { merchant: string; date: string; items: { name: string; amount: number; category: string }[] }
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: "Ungültiges Format von KI" }, { status: 422 })
  }

  const itemsWithIds = parsed.items.map(item => {
    const matched = categories.find(c => c.name.toLowerCase() === item.category?.toLowerCase())
    const fallback = categories.find(c => c.name === "Sonstiges")
    return {
      ...item,
      categoryId: matched?.id ?? fallback?.id ?? categories[0]?.id,
      categoryName: matched?.name ?? item.category,
    }
  })

  return NextResponse.json({ merchant: parsed.merchant, date: parsed.date, items: itemsWithIds })
}
