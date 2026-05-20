import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { asDateOnlyString, asNonEmptyString, asPositiveNumber } from "@/lib/api-validation"

const MAX_FILE_SIZE = 8 * 1024 * 1024
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY nicht konfiguriert" }, { status: 503 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Kein Bild" }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Bild ist zu gross" }, { status: 413 })
  if (!ALLOWED_MEDIA_TYPES.has(file.type)) return NextResponse.json({ error: "Nicht unterstützter Bildtyp" }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString("base64")
  const mediaType = file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif"

  const categories = await prisma.category.findMany()
  if (categories.length === 0) return NextResponse.json({ error: "Keine Kategorien konfiguriert" }, { status: 503 })
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
            text: `Analysiere dieses Zahlungsdokument (Quittung, Rechnung, Beleg, etc.) und extrahiere alle relevanten Informationen.

Antworte NUR mit validem JSON, kein anderer Text:
{
  "documentType": "receipt" oder "invoice",
  "merchant": "Name des Ausstellers oder Unbekannt",
  "date": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD oder null (nur bei Rechnungen mit Zahlungsfrist)",
  "reference": "Referenz-/Rechnungsnummer oder null",
  "items": [
    { "name": "Beschreibung", "amount": 12.50, "category": "Kategoriename" }
  ]
}

Verfügbare Kategorien: ${categoryNames}

Regeln:
- documentType: "receipt" für Kassenbelege/Quittungen, "invoice" für Rechnungen/Bills
- date: Ausstellungsdatum, falls nicht lesbar nimm ${today}
- dueDate: Zahlungsfrist bei Rechnungen, sonst null
- reference: Rechnungsnummer, Zahlungsreferenz, ESR-Nummer etc., sonst null
- Beträge: immer positiv, 2 Dezimalstellen
- Bei Rechnungen: ein Posten mit dem Gesamtbetrag reicht, ausser Einzelpositionen sind klar aufgeführt
- Bei Quittungen: jeden Posten einzeln erfassen, keine Rabatte oder Zwischensummen
- Wähle die passendste verfügbare Kategorie`,
          },
        ],
      }],
    })
    const content = response.content.find(c => c.type === "text")
    text = content?.type === "text" ? content.text : ""
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler"
    return NextResponse.json({ error: `KI-Fehler: ${msg.slice(0, 120)}` }, { status: 502 })
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: "Dokument konnte nicht gelesen werden" }, { status: 422 })

  let parsed: {
    documentType: string
    merchant: string
    date: string
    dueDate: string | null
    reference: string | null
    items: { name: string; amount: number; category: string }[]
  }
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: "Ungültiges Format von KI" }, { status: 422 })
  }
  if (!["receipt", "invoice"].includes(parsed.documentType)) {
    return NextResponse.json({ error: "Ungültiger Dokumenttyp von KI" }, { status: 422 })
  }
  parsed.date = asDateOnlyString(parsed.date) ?? today
  parsed.dueDate = parsed.dueDate ? asDateOnlyString(parsed.dueDate) : null
  parsed.merchant = asNonEmptyString(parsed.merchant) ?? "Unbekannt"
  parsed.reference = asNonEmptyString(parsed.reference) ?? null
  if (!Array.isArray(parsed.items) || parsed.items.length === 0 || parsed.items.length > 100) {
    return NextResponse.json({ error: "Keine gültigen Positionen erkannt" }, { status: 422 })
  }

  const itemsWithIds = parsed.items.flatMap(item => {
    const name = asNonEmptyString(item.name)
    const amount = asPositiveNumber(item.amount)
    if (!name || amount === null) return []
    const matched = categories.find(c => c.name.toLowerCase() === item.category?.toLowerCase())
    const fallback = categories.find(c => c.name === "Sonstiges")
    return {
      name,
      amount: Math.round(amount * 100) / 100,
      category: item.category,
      categoryId: matched?.id ?? fallback?.id ?? categories[0]?.id,
      categoryName: matched?.name ?? item.category,
    }
  })
  if (itemsWithIds.length === 0) {
    return NextResponse.json({ error: "Keine gültigen Positionen erkannt" }, { status: 422 })
  }

  return NextResponse.json({
    documentType: parsed.documentType,
    merchant: parsed.merchant,
    date: parsed.date,
    dueDate: parsed.dueDate ?? null,
    reference: parsed.reference ?? null,
    items: itemsWithIds,
  })
}
