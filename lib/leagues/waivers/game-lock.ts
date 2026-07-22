import type { ScheduleGame } from "@/lib/espn/scoreboard";

/** Abbreviations of NFL teams whose game has started (in/post) for this board. */
export function getStartedNflTeamAbbreviations(
  games: ScheduleGame[],
  now: Date = new Date(),
): Set<string> {
  const started = new Set<string>();
  const nowMs = now.getTime();

  for (const game of games) {
    const kickoffMs = new Date(game.kickoff).getTime();
    const hasStarted =
      game.status === "in" ||
      game.status === "post" ||
      (Number.isFinite(kickoffMs) && kickoffMs <= nowMs);

    if (!hasStarted) continue;

    started.add(game.home.abbreviation.toUpperCase());
    started.add(game.away.abbreviation.toUpperCase());
  }

  return started;
}

export function hasNflTeamStarted(
  nflTeam: string | null | undefined,
  startedTeams: Set<string>,
): boolean {
  if (!nflTeam) return false;
  const abbr = nflTeam.toUpperCase();
  // Sleeper uses WAS; ESPN may use WSH in kickoffs — both checked by callers
  // that normalize before building the set. Accept either form here.
  if (startedTeams.has(abbr)) return true;
  if (abbr === "WAS" && startedTeams.has("WSH")) return true;
  if (abbr === "WSH" && startedTeams.has("WAS")) return true;
  return false;
}
