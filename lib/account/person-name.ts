/** Full name from account settings; falls back to username. */
export function formatPersonName(input: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): string {
  const fullName = [input.firstName, input.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;
  return input.username?.trim() || "Manager";
}
