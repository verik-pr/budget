export function formatCHF(amount: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount)
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function monthName(date: Date) {
  return date.toLocaleDateString("de-CH", { month: "long", year: "numeric" })
}
