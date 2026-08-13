export const CONTRIBUTORS = [
  { value: "erik", label: "Erik", color: "#6366f1" },
  { value: "celine", label: "Céline", color: "#ec4899" },
  { value: "eltern_erik", label: "Eriks Eltern", color: "#3b82f6" },
  { value: "eltern_celine", label: "Célines Eltern", color: "#f43f5e" },
]

export function getContributorLabel(contributor: string | null, userName: string) {
  if (!contributor) return userName
  return CONTRIBUTORS.find(c => c.value === contributor)?.label ?? userName
}

export function contributorFromName(userName: string): string {
  const first = userName.split(" ")[0]?.toLowerCase() ?? ""
  return CONTRIBUTORS.find(c => c.label.toLowerCase().startsWith(first))?.value ?? "erik"
}

export type PersonMode = "effektiv" | "bezahlt"

// Wem gehört eine Ausgabe? "bezahlt": alles beim Zahler (contributor bzw.
// buchender User). "effektiv": bei Splits anteilig auf beide verteilt.
export function expenseShares(
  t: { amount: number; contributor: string | null; sharedWith: string | null; sharedRatio: number | null; user: { name: string } },
  mode: PersonMode
): [string, number][] {
  const payer = t.contributor ?? contributorFromName(t.user.name)
  if (mode === "bezahlt" || !t.sharedWith || !t.sharedRatio) return [[payer, t.amount]]
  return [
    [payer, t.amount * (1 - t.sharedRatio)],
    [t.sharedWith, t.amount * t.sharedRatio],
  ]
}

// Beträge wie "12,50", "1'234.50" oder "12.50" robust parsen (CH-Tastatur!)
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(/['\s]/g, "").replace(",", ".")
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

// Heutiges Datum als YYYY-MM-DD in LOKALER Zeit (toISOString wäre UTC:
// zwischen 00:00 und 02:00 Schweizer Zeit ergäbe das den Vortag)
export function todayLocalISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Rabattfaktor einer Geschenkkarte (900 bezahlt / 1000 Guthaben = 0.9).
// 1 für alle anderen Konten — Buchungen bleiben dann unverändert.
export function giftcardFactor(acc: { type: string; giftcardFaceValue?: number | null; giftcardPrice?: number | null } | null | undefined): number {
  if (!acc || acc.type !== "giftcard" || !acc.giftcardFaceValue || !acc.giftcardPrice) return 1
  return acc.giftcardPrice / acc.giftcardFaceValue
}

// Offener Kreditkarten-Saldo: Ausgaben minus Zahlungen (Einnahmen-Buchungen)
export function creditCardBalanceOf(txs: { amount: number; category: { type: string } }[]): number {
  return txs.reduce((s, t) => s + (t.category.type === "income" ? -t.amount : t.amount), 0)
}

export function formatCHF(amount: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount)
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function monthName(date: Date) {
  return date.toLocaleDateString("de-CH", { month: "long", year: "numeric" })
}
