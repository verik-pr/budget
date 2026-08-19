import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { asDateOnlyString, asNonEmptyString, asPositiveNumber } from "@/lib/api-validation"

const MAX_FILE_SIZE = 8 * 1024 * 1024
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

// Schweizer Punkt-Daten deterministisch als TT.MM.JJJJ parsen («02.05.2026» =
// 2. Mai). Die KI dreht bei der YYYY-MM-DD-Konvertierung sonst gelegentlich
// Tag und Monat um (US-Lesart MM/DD) — deshalb hat dieses Parsing des exakt
// abgedruckten Datums Vorrang vor dem konvertierten Datum der KI.
function parseSwissDate(raw: string | null | undefined): string | null {
  const m = raw?.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  const year = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10)
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

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
  let truncated = false
  try {
    const response = await client.messages.create({
      // Sonnet statt Haiku: hochauflösende Bildverarbeitung (2576px statt 1568px)
      // liest das Kleingedruckte auf Kassenzetteln deutlich zuverlässiger
      // (Datum, Beträge) — Mehrkosten pro Scan: wenige Rappen
      model: "claude-sonnet-5",
      // Lange Kassenzettel (30+ Posten) brauchen deutlich mehr als 1024 Tokens,
      // sonst wird das JSON abgeschnitten -> "Ungültiges Format von KI"
      max_tokens: 8192,
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
  "dateRaw": "Ausstellungsdatum EXAKT wie auf dem Dokument gedruckt, z.B. 02.05.2026, oder null",
  "dueDate": "YYYY-MM-DD oder null (nur bei Rechnungen mit Zahlungsfrist)",
  "dueDateRaw": "Zahlungsfrist EXAKT wie gedruckt, oder null",
  "reference": "Referenz-/Rechnungsnummer oder null",
  "items": [
    { "name": "Beschreibung", "amount": 12.50, "category": "Kategoriename" }
  ]
}

Verfügbare Kategorien: ${categoryNames}

Regeln:
- documentType: "receipt" für Kassenbelege/Quittungen, "invoice" für Rechnungen/Bills

Datum (sorgfältig vom Beleg ablesen):
- dateRaw: das aufgedruckte Kauf-/Ausstellungsdatum EXAKT abschreiben. Auf Schweizer Kassenzetteln steht es meist oben oder unten beim Zeitstempel (z.B. «04.08.26 17:32»).
- ACHTUNG Datumsformat: Schweizer Belege drucken TT.MM.JJJJ — «02.05.2026» ist der 2. Mai 2026, NICHT der 5. Februar. Zweistellige Jahre: 26 = 2026.
- date: dasselbe Datum als YYYY-MM-DD; nur wenn wirklich keines lesbar ist, nimm ${today}
- dueDate: Zahlungsfrist bei Rechnungen, sonst null
- reference: Rechnungsnummer, Zahlungsreferenz, ESR-Nummer etc., sonst null

Posten — NUR echte Käufe erfassen:
- Beträge: immer positiv, 2 Dezimalstellen, exakt wie aufgedruckt
- Bei Rechnungen: ein Posten mit dem Gesamtbetrag reicht, ausser Einzelpositionen sind klar aufgeführt
- Bei Quittungen: jeden gekauften Artikel einzeln erfassen
- Diese Zeilen sind KEINE Käufe und werden NIE als Posten erfasst:
  * Treueprogramm-Zeilen: Cumulus, Cumulus-Punkte, Supercard, Superpunkte, Bonuspunkte, Punktestand
  * Summenzeilen: TOTAL, Zwischensumme, Summe
  * Zahlungszeilen: Bar, Karte, Maestro, TWINT, Gegeben, Rückgeld
  * MwSt-/Steuer-Tabellen, Rundungszeilen, «Sie sparen»-Zeilen
  * Pfand-Rückgaben und andere negative Beträge
- Ist ein Rabatt direkt einem Artikel zugeordnet, erfasse den Artikel mit dem effektiv bezahlten Preis
- Wähle die passendste verfügbare Kategorie (z.B. Putzmittel/Spülsalz → Haushalt)`,
          },
        ],
      }],
    })
    const content = response.content.find(c => c.type === "text")
    text = content?.type === "text" ? content.text : ""
    truncated = response.stop_reason === "max_tokens"
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler"
    return NextResponse.json({ error: `KI-Fehler: ${msg.slice(0, 120)}` }, { status: 502 })
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error("scan-receipt: kein JSON in KI-Antwort", text.slice(0, 300))
    return NextResponse.json({ error: "Dokument konnte nicht gelesen werden" }, { status: 422 })
  }

  let parsed: {
    documentType: string
    merchant: string
    date: string
    dateRaw?: string | null
    dueDate: string | null
    dueDateRaw?: string | null
    reference: string | null
    items: { name: string; amount: number; category: string }[]
  }
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    console.error("scan-receipt: JSON-Parse fehlgeschlagen", { truncated, tail: text.slice(-200) })
    return NextResponse.json({
      error: truncated
        ? "Quittung zu lang für einen Scan — bitte in zwei Fotos aufteilen"
        : "Ungültiges Format von KI — bitte nochmal scannen",
    }, { status: 422 })
  }
  if (!["receipt", "invoice"].includes(parsed.documentType)) {
    return NextResponse.json({ error: "Ungültiger Dokumenttyp von KI" }, { status: 422 })
  }
  parsed.date = parseSwissDate(parsed.dateRaw) ?? asDateOnlyString(parsed.date) ?? today
  parsed.dueDate = parseSwissDate(parsed.dueDateRaw) ?? (parsed.dueDate ? asDateOnlyString(parsed.dueDate) : null)
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
