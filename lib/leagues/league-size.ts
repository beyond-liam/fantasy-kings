/** Placeholder names for commissioner “fill empty slots” bots. */
export const BOT_TEAM_NAMES = [
  "Gridiron Gang",
  "Red Zone Renegades",
  "Blitz Brigade",
  "Pocket Passers",
  "End Zone Express",
  "Fourth Down Faithful",
  "Hashmark Heroes",
  "Sunday Scramblers",
  "Goal Line Guardians",
  "Trophy Hunters",
  "Pigskin Prophets",
  "Audible Outlaws",
  "Two Minute Drill",
  "Nose Tackle Nasties",
  "Fantasy Phenoms",
] as const;

/** Next unused bot display name, falling back to numbered slots. */
export function nextBotTeamName(
  usedNames: Set<string>,
  index: number,
): string {
  for (const name of BOT_TEAM_NAMES) {
    if (!usedNames.has(name.toLowerCase())) {
      return name;
    }
  }
  return `Bot Team ${index + 1}`;
}

/** Profile label written by commissioner “fill with bots”. */
export function isBotManagerDisplayName(name: string | null | undefined): boolean {
  return /^Bot Manager \d+$/.test(name?.trim() ?? "");
}
