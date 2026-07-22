export function formatLeagueLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b([a-z])/g, (_, char: string) => char.toUpperCase())
    .replace(/\bPpr\b/g, "PPR")
    .replace(/\bFaab\b/g, "FAAB");
}
