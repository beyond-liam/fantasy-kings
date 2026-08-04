/** Full name from account settings; falls back to displayName, then username. */
export function formatPersonName(input: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  displayName?: string | null;
}): string {
  const fullName = [input.firstName, input.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;
  const displayName = input.displayName?.trim();
  if (displayName) return displayName;
  return input.username?.trim() || "Manager";
}
