/**
 * Choke / Fergie from the last NFL kickoff wave in a fantasy matchup week.
 *
 * Before the last kickoff among starters: who led?
 * After finals: who won?
 * Lead blown → choke for leader, Fergie for trailing side.
 */

export type LateGameStarter = {
  kickoff: string | null;
  actualPts: number | null;
};

export type LastKickoffSwing = {
  chokeTeamId: string;
  fergieTeamId: string;
};

function uniqueSortedKickoffs(starters: LateGameStarter[]): string[] {
  const set = new Set<string>();
  for (const starter of starters) {
    if (starter.kickoff) set.add(starter.kickoff);
  }
  return [...set].toSorted(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );
}

function sumBeforeLastKickoff(
  starters: LateGameStarter[],
  lastKickoff: string,
): number {
  let total = 0;
  for (const starter of starters) {
    if (!starter.kickoff) continue;
    if (starter.kickoff === lastKickoff) continue;
    total += starter.actualPts ?? 0;
  }
  return total;
}

/**
 * Classify a finalized matchup. Returns null when there aren't two kickoff
 * waves, the matchup tied, or the score was tied entering the last wave.
 */
export function classifyLastKickoffSwing(input: {
  homeTeamId: string;
  awayTeamId: string;
  homePts: number;
  awayPts: number;
  homeStarters: LateGameStarter[];
  awayStarters: LateGameStarter[];
}): LastKickoffSwing | null {
  if (input.homePts === input.awayPts) return null;

  const kickoffs = uniqueSortedKickoffs([
    ...input.homeStarters,
    ...input.awayStarters,
  ]);
  if (kickoffs.length < 2) return null;

  const lastKickoff = kickoffs[kickoffs.length - 1]!;
  const homeBefore = sumBeforeLastKickoff(input.homeStarters, lastKickoff);
  const awayBefore = sumBeforeLastKickoff(input.awayStarters, lastKickoff);

  if (homeBefore === awayBefore) return null;

  const homeWon = input.homePts > input.awayPts;
  const homeLed = homeBefore > awayBefore;

  if (homeLed && !homeWon) {
    return {
      chokeTeamId: input.homeTeamId,
      fergieTeamId: input.awayTeamId,
    };
  }
  if (!homeLed && homeWon) {
    return {
      chokeTeamId: input.awayTeamId,
      fergieTeamId: input.homeTeamId,
    };
  }
  return null;
}

export function countChokeAndFergieByTeam(
  swings: LastKickoffSwing[],
): { choke: Map<string, number>; fergie: Map<string, number> } {
  const choke = new Map<string, number>();
  const fergie = new Map<string, number>();
  for (const swing of swings) {
    choke.set(swing.chokeTeamId, (choke.get(swing.chokeTeamId) ?? 0) + 1);
    fergie.set(swing.fergieTeamId, (fergie.get(swing.fergieTeamId) ?? 0) + 1);
  }
  return { choke, fergie };
}
