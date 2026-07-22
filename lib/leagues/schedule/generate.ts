export type GeneratedMatchup = {
  week: number;
  homeTeamId: string;
  awayTeamId: string;
};

const BYE = "__BYE__";

/**
 * Circle-method round robin. Returns one complete set of rounds where every
 * team plays every other team exactly once before any rematch.
 *
 * Odd team counts get a bye each round (phantom opponent).
 */
export function buildRoundRobinRounds(
  teamIds: string[],
): Array<Array<[string, string]>> {
  if (teamIds.length < 2) {
    return [];
  }

  const teams = [...teamIds];
  if (teams.length % 2 === 1) {
    teams.push(BYE);
  }

  const n = teams.length;
  const half = n / 2;
  const rotating = teams.slice(1);
  const rounds: Array<Array<[string, string]>> = [];

  for (let round = 0; round < n - 1; round++) {
    const order = [teams[0], ...rotating];
    const pairs: Array<[string, string]> = [];

    for (let i = 0; i < half; i++) {
      const a = order[i]!;
      const b = order[n - 1 - i]!;
      if (a === BYE || b === BYE) {
        continue;
      }

      // Alternate home/away by round so travel (or first-listed) balances.
      if (round % 2 === 0) {
        pairs.push([a, b]);
      } else {
        pairs.push([b, a]);
      }
    }

    rounds.push(pairs);
    const last = rotating.pop();
    if (last) {
      rotating.unshift(last);
    }
  }

  return rounds;
}

function rotateTeamList(teamIds: string[], offset: number): string[] {
  if (teamIds.length === 0) {
    return [];
  }
  const shift = ((offset % teamIds.length) + teamIds.length) % teamIds.length;
  return [...teamIds.slice(shift), ...teamIds.slice(0, shift)];
}

/**
 * Build a regular-season schedule for `weekCount` weeks.
 *
 * Guarantees every pair faces off once before any rematch: full round-robin
 * cycles are completed (or partly completed) before a new cycle starts.
 * `playEachOtherTimes` is the target number of full cycles preferred, but the
 * season always fills `weekCount` weeks — additional cycles may start after
 * the preferred count if weeks remain.
 */
export function generateRegularSeasonSchedule(input: {
  teamIds: string[];
  weekCount: number;
  playEachOtherTimes: 1 | 2 | 3;
}): GeneratedMatchup[] {
  const { teamIds, weekCount, playEachOtherTimes } = input;
  if (teamIds.length < 2 || weekCount < 1) {
    return [];
  }

  const roundsPerCycle = buildRoundRobinRounds(teamIds).length;
  if (roundsPerCycle === 0) {
    return [];
  }

  // Enough cycles to cover preferred rematches AND fill the season calendar.
  const cyclesNeeded = Math.max(
    playEachOtherTimes,
    Math.ceil(weekCount / roundsPerCycle),
  );

  const allRounds: Array<Array<[string, string]>> = [];
  for (let cycle = 0; cycle < cyclesNeeded; cycle++) {
    const ordered = rotateTeamList(teamIds, cycle);
    allRounds.push(...buildRoundRobinRounds(ordered));
  }

  const matchups: GeneratedMatchup[] = [];
  for (let week = 1; week <= weekCount; week++) {
    const pairs = allRounds[week - 1];
    if (!pairs) {
      break;
    }
    for (const [homeTeamId, awayTeamId] of pairs) {
      matchups.push({ week, homeTeamId, awayTeamId });
    }
  }

  return matchups;
}

/** Pair key independent of home/away for uniqueness checks. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
