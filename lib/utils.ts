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

export function formatCHF(amount: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount)
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function monthName(date: Date) {
  return date.toLocaleDateString("de-CH", { month: "long", year: "numeric" })
}
