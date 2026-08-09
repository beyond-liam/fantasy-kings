/** Map legacy / code-ish labels to natural language for feed display. */
const SETTINGS_LABEL_ALIASES: Record<string, string> = {
  "Regular-season schedule": "regular season schedule",
};

/**
 * Section labels sit mid-sentence ("Commissioner updated …").
 * Always sentence-case (lowercase) so title-case write-time labels don't show.
 */
export function formatSettingsActivityLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "league settings";
  const aliased = SETTINGS_LABEL_ALIASES[trimmed] ?? trimmed;
  return aliased.toLowerCase();
}
