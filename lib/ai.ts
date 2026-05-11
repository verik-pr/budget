import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "./prisma"
import { formatCHF } from "./utils"

const HAIKU = "claude-haiku-4-5-20251001"

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set")
  return new Anthropic({ apiKey })
}

function periodStartFor(date: Date): Date {
  return date.getDate() >= 24
    ? new Date(date.getFullYear(), date.getMonth(), 24)
    : new Date(date.getFullYear(), date.getMonth() - 1, 24)
}

function extractJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) as T } catch { return null }
}

export async function suggestCategory(description: string, type: "expense" | "income"): Promise<{ categoryId: string; confidence: number } | null> {
  if (!description || description.trim().length < 3) return null

  const categories = await prisma.category.findMany({ where: { type } })
  if (categories.length === 0) return null

  const recent = await prisma.transaction.findMany({
    where: { description: { not: null }, category: { type } },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
    take: 40,
    distinct: ["description"],
  })

  const catList = categories.map(c => `- ${c.id} | ${c.icon} ${c.name}`).join("\n")
  const examples = recent.map(t => `"${t.description}" → ${t.category.id}`).join("\n")

  const result = await client().messages.create({
    model: HAIKU,
    max_tokens: 100,
    system: `Du klassifizierst Buchungs-Beschreibungen in eine vorhandene Kategorie. Antworte ausschliesslich als JSON: {"categoryId":"…","confidence":0.0-1.0}. Wenn unsicher → confidence < 0.5.`,
    messages: [{
      role: "user",
      content: `Kategorien:\n${catList}\n\nFrühere Buchungen:\n${examples}\n\nNeue Buchung: "${description}"\n\nJSON:`,
    }],
  })

  const text = result.content.find(c => c.type === "text")?.type === "text" ? (result.content[0] as { text: string }).text : ""
  const parsed = extractJson<{ categoryId: string; confidence: number }>(text)
  if (!parsed) return null
  if (!categories.find(c => c.id === parsed.categoryId)) return null
  return parsed
}

export async function generateWeeklySummary(userId: string): Promise<string | null> {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - 7)
  const prevWeekStart = new Date(now)
  prevWeekStart.setDate(now.getDate() - 14)

  const [thisWeek, lastWeek] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: weekStart, lt: now } },
      include: { category: true },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: prevWeekStart, lt: weekStart } },
      include: { category: true },
    }),
  ])

  if (thisWeek.length === 0) return null

  const summarize = (txs: typeof thisWeek) => {
    const byCat: Record<string, { name: string; total: number; count: number }> = {}
    for (const t of txs) {
      if (t.category.type !== "expense") continue
      const k = t.category.name
      if (!byCat[k]) byCat[k] = { name: k, total: 0, count: 0 }
      byCat[k].total += t.amount
      byCat[k].count += 1
    }
    return {
      total: Object.values(byCat).reduce((s, c) => s + c.total, 0),
      cats: Object.values(byCat).sort((a, b) => b.total - a.total),
    }
  }

  const cur = summarize(thisWeek)
  const prev = summarize(lastWeek)
  if (cur.total === 0) return null

  const diffPct = prev.total > 0 ? Math.round(((cur.total - prev.total) / prev.total) * 100) : null

  const result = await client().messages.create({
    model: HAIKU,
    max_tokens: 200,
    system: `Du fasst eine Wochen-Budget-Übersicht in 2 kurzen deutschen Sätzen zusammen. Verwende CHF-Formatierung. Sei prägnant und freundlich, ohne Emojis. Antworte nur mit dem Text, keine Erklärung.`,
    messages: [{
      role: "user",
      content: `Diese Woche: ${formatCHF(cur.total)} ausgegeben (${thisWeek.length} Buchungen).
Top-Kategorien: ${cur.cats.slice(0, 3).map(c => `${c.name} ${formatCHF(c.total)}`).join(", ")}.
Letzte Woche: ${formatCHF(prev.total)}${diffPct !== null ? ` (Differenz ${diffPct > 0 ? "+" : ""}${diffPct}%)` : ""}.

Schreibe eine knappe Zusammenfassung.`,
    }],
  })

  const text = result.content.find(c => c.type === "text")
  if (!text || text.type !== "text") return null
  return text.text.trim()
}

export async function generateForecast(accountId: string | null): Promise<{ projected: number; message: string } | null> {
  const now = new Date()
  const periodStart = periodStartFor(now)
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 24)
  const daysElapsed = Math.max(1, Math.ceil((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)))
  const daysTotal = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
  const daysLeft = daysTotal - daysElapsed
  if (daysLeft <= 0) return null

  const accountFilter = accountId ? { OR: [{ accountId }, { accountId: null }] } : {}
  const txs = await prisma.transaction.findMany({
    where: { date: { gte: periodStart, lt: periodEnd }, ...accountFilter },
    include: { category: true },
    orderBy: { date: "asc" },
  })

  const expenses = txs.filter(t => t.category.type === "expense")
  const spent = expenses.reduce((s, t) => s + t.amount, 0)
  if (expenses.length < 3) return null

  const prevStart = new Date(periodStart.getFullYear(), periodStart.getMonth() - 1, 24)
  const prevEnd = periodStart
  const prevTxs = await prisma.transaction.findMany({
    where: { date: { gte: prevStart, lt: prevEnd }, ...accountFilter },
    include: { category: true },
  })
  const prevSpent = prevTxs.filter(t => t.category.type === "expense").reduce((s, t) => s + t.amount, 0)

  const linearProjection = (spent / daysElapsed) * daysTotal

  const byDayOfWeek: Record<number, { sum: number; count: number }> = {}
  for (const t of expenses) {
    const d = new Date(t.date).getDay()
    if (!byDayOfWeek[d]) byDayOfWeek[d] = { sum: 0, count: 0 }
    byDayOfWeek[d].sum += t.amount
    byDayOfWeek[d].count += 1
  }

  const result = await client().messages.create({
    model: HAIKU,
    max_tokens: 200,
    system: `Du bist ein Budget-Analyst. Schätze die finale Ausgabensumme bis Periodenende basierend auf bisherigem Verlauf. Antworte ausschliesslich als JSON: {"projected": <chf-zahl>, "message": "<1 kurzer deutscher Satz>"}. Berücksichtige Wochentage und Vormonats-Vergleich.`,
    messages: [{
      role: "user",
      content: `Periode: ${periodStart.toISOString().slice(0, 10)} bis ${periodEnd.toISOString().slice(0, 10)}.
Tage vergangen: ${daysElapsed} / ${daysTotal} (${daysLeft} verbleibend).
Bisher ausgegeben: ${formatCHF(spent)} (${expenses.length} Buchungen).
Lineare Hochrechnung wäre: ${formatCHF(linearProjection)}.
Vergleich Vorperiode komplett: ${formatCHF(prevSpent)}.

JSON:`,
    }],
  })

  const text = result.content.find(c => c.type === "text")?.type === "text" ? (result.content[0] as { text: string }).text : ""
  const parsed = extractJson<{ projected: number; message: string }>(text)
  if (!parsed || typeof parsed.projected !== "number") return null
  return parsed
}
