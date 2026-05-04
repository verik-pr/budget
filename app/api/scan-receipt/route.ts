import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY nicht konfiguriert" }, { status: 503 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Kein Bild" }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString("base64")
  const mimeType = file.type || "image/jpeg"

  const categories = await prisma.category.findMany()
  const categoryNames = categories.map(c => c.name).join(", ")
  const today = new Date().toISOString().split("T")[0]

  const prompt = `Analysiere diese Quittung und extrahiere alle Positionen mit Preisen.

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
- Keine Rabatte oder Zwischensummen als separate Posten`

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`

  let geminiRes: Response
  try {
    geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: prompt },
          ],
        }],
      }),
    })
  } catch (err) {
    return NextResponse.json({ error: "Netzwerkfehler zur KI" }, { status: 502 })
  }

  if (!geminiRes.ok) {
    const body = await geminiRes.json().catch(() => ({}))
    const msg = body?.error?.message ?? geminiRes.statusText
    return NextResponse.json({ error: `KI-Fehler (${geminiRes.status}): ${msg}` }, { status: geminiRes.status })
  }

  const data = await geminiRes.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

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
