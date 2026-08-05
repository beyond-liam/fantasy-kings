import { getAdp } from "@/lib/rankings/stat-helpers";

export type DraftGradeLetter =
  | "A+"
  | "A"
  | "B+"
  | "B"
  | "C+"
  | "C"
  | "D"
  | "F";

export const DRAFT_GRADE_LETTERS: DraftGradeLetter[] = [
  "A+",
  "A",
  "B+",
  "B",
  "C+",
  "C",
  "D",
  "F",
];

export function draftGradeImageSrc(letter: DraftGradeLetter): string {
  const slug = letter
    .toLowerCase()
    .replace("+", "-plus");
  return `/draft-grade-${slug}.png`;
}

export type DraftGradePickInput = {
  teamId: string;
  playerId: string;
  overall: number;
  round: number;
  pickInRound: number;
  fantasyPts: number | null;
  adp: number | null;
  primaryPositionId: string;
};

export type DraftGradeTeamInput = {
  teamId: string;
};

export type DraftGradeComputeInput = {
  teams: DraftGradeTeamInput[];
  picks: DraftGradePickInput[];
  starterSlots: number;
  regularSeasonWeeks: number;
  playoffTeamCount: number;
};

export type DraftGradeValuePick = {
  playerId: string;
  overall: number;
  round: number;
  pickInRound: number;
  adp: number;
  /** overall − ADP (positive = steal / late relative to ADP). */
  value: number;
};

export type DraftGradeTeamResult = {
  teamId: string;
  letter: DraftGradeLetter;
  score: number;
  leagueRank: number;
  teamCount: number;
  projectedWins: number;
  projectedLosses: number;
  playoffOdds: number;
  championshipOdds: number;
  bestValue: DraftGradeValuePick | null;
  worstValue: DraftGradeValuePick | null;
  headline: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function starterCount(starterSlots: number) {
  return Math.max(1, Math.floor(starterSlots));
}

/** Higher projected pts weighted for starters; bench discounted. */
export function teamProjectedStrength(
  picks: DraftGradePickInput[],
  starterSlots: number,
): number {
  const starters = starterCount(starterSlots);
  const sorted = [...picks].sort(
    (a, b) => (b.fantasyPts ?? 0) - (a.fantasyPts ?? 0),
  );
  let total = 0;
  sorted.forEach((pick, index) => {
    const pts = pick.fantasyPts ?? 0;
    total += index < starters ? pts : pts * 0.35;
  });
  return total;
}

export function pickAdpValue(pick: DraftGradePickInput): number | null {
  if (pick.adp == null || !Number.isFinite(pick.adp)) return null;
  return pick.overall - pick.adp;
}

export function averageAdpValue(picks: DraftGradePickInput[]): number {
  const values = picks
    .map(pickAdpValue)
    .filter((value): value is number => value != null);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bestAndWorstValue(picks: DraftGradePickInput[]): {
  best: DraftGradeValuePick | null;
  worst: DraftGradeValuePick | null;
} {
  let best: DraftGradeValuePick | null = null;
  let worst: DraftGradeValuePick | null = null;

  for (const pick of picks) {
    const value = pickAdpValue(pick);
    if (value == null || pick.adp == null) continue;
    const row: DraftGradeValuePick = {
      playerId: pick.playerId,
      overall: pick.overall,
      round: pick.round,
      pickInRound: pick.pickInRound,
      adp: pick.adp,
      value,
    };
    if (!best || row.value > best.value) best = row;
    if (!worst || row.value < worst.value) worst = row;
  }

  return { best, worst };
}

/** Rank 1 = best. */
export function letterFromLeagueRank(
  rank: number,
  teamCount: number,
): DraftGradeLetter {
  const n = Math.max(1, teamCount);
  const r = clamp(rank, 1, n);
  // Even small leagues get a spread across the scale.
  const pct = n === 1 ? 1 : (n - r) / (n - 1);

  if (pct >= 0.92) return "A+";
  if (pct >= 0.78) return "A";
  if (pct >= 0.62) return "B+";
  if (pct >= 0.46) return "B";
  if (pct >= 0.32) return "C+";
  if (pct >= 0.18) return "C";
  if (pct >= 0.08) return "D";
  return "F";
}

function headlineFor(letter: DraftGradeLetter, rank: number): string {
  switch (letter) {
    case "A+":
      return rank === 1 ? "Draft champion" : "Elite haul";
    case "A":
      return "Title contender";
    case "B+":
      return "Playoff bound";
    case "B":
      return "Solid foundation";
    case "C+":
      return "Work to do";
    case "C":
      return "Middle of the pack";
    case "D":
      return "Tough hill ahead";
    case "F":
      return "Rebuild mode";
  }
}

function playoffLabelOdds(rank: number, teamCount: number, playoffSpots: number) {
  const spots = clamp(playoffSpots, 2, teamCount);
  if (rank <= spots) {
    // Locked-ish for top seeds; still room to miss.
    const cushion = spots - rank + 1;
    return clamp(72 + cushion * 6, 70, 96);
  }
  const gap = rank - spots;
  return clamp(55 - gap * 12, 4, 48);
}

function championshipOddsFrom(
  playoffOdds: number,
  rank: number,
  playoffSpots: number,
) {
  const seedFactor = rank <= playoffSpots ? (playoffSpots - rank + 1) / playoffSpots : 0.15;
  return clamp(playoffOdds * seedFactor * 0.55, 1, 55);
}

/**
 * Pure draft-grade evaluation for all teams in a completed draft.
 */
export function computeDraftGrades(
  input: DraftGradeComputeInput,
): DraftGradeTeamResult[] {
  const teamCount = Math.max(1, input.teams.length);
  const weeks = Math.max(1, input.regularSeasonWeeks);
  const playoffSpots = clamp(input.playoffTeamCount, 2, teamCount);

  const picksByTeam = new Map<string, DraftGradePickInput[]>();
  for (const team of input.teams) {
    picksByTeam.set(team.teamId, []);
  }
  for (const pick of input.picks) {
    const list = picksByTeam.get(pick.teamId);
    if (list) list.push(pick);
  }

  const strengths = input.teams.map((team) => {
    const picks = picksByTeam.get(team.teamId) ?? [];
    return {
      teamId: team.teamId,
      strength: teamProjectedStrength(picks, input.starterSlots),
      adpValue: averageAdpValue(picks),
      picks,
    };
  });

  const strengthSorted = [...strengths].sort((a, b) => b.strength - a.strength);
  const adpSorted = [...strengths].sort((a, b) => b.adpValue - a.adpValue);

  const strengthRank = new Map<string, number>();
  const adpRank = new Map<string, number>();
  strengthSorted.forEach((row, index) => strengthRank.set(row.teamId, index + 1));
  adpSorted.forEach((row, index) => adpRank.set(row.teamId, index + 1));

  const avgStrength =
    strengths.reduce((sum, row) => sum + row.strength, 0) /
    Math.max(1, strengths.length);
  const strengthSpread = Math.max(
    40,
    ...strengths.map((row) => Math.abs(row.strength - avgStrength)),
  );

  const scored = strengths.map((row) => {
    const sRank = strengthRank.get(row.teamId) ?? teamCount;
    const aRank = adpRank.get(row.teamId) ?? teamCount;
    const strengthScore = teamCount === 1 ? 100 : ((teamCount - sRank) / (teamCount - 1)) * 100;
    const adpScore = teamCount === 1 ? 100 : ((teamCount - aRank) / (teamCount - 1)) * 100;
    const score = strengthScore * 0.7 + adpScore * 0.3;
    return { ...row, score, sRank };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.teamId.localeCompare(b.teamId);
  });

  return scored.map((row, index) => {
    const leagueRank = index + 1;
    const letter = letterFromLeagueRank(leagueRank, teamCount);
    const delta = row.strength - avgStrength;
    const winPct = 1 / (1 + Math.exp(-delta / (strengthSpread * 0.45)));
    const projectedWins = clamp(Math.round(winPct * weeks), 0, weeks);
    const projectedLosses = weeks - projectedWins;
    const playoffOdds = playoffLabelOdds(leagueRank, teamCount, playoffSpots);
    const championshipOdds = championshipOddsFrom(
      playoffOdds,
      leagueRank,
      playoffSpots,
    );
    const { best, worst } = bestAndWorstValue(row.picks);

    return {
      teamId: row.teamId,
      letter,
      score: Math.round(row.score * 10) / 10,
      leagueRank,
      teamCount,
      projectedWins,
      projectedLosses,
      playoffOdds,
      championshipOdds,
      bestValue: best,
      worstValue: worst,
      headline: headlineFor(letter, leagueRank),
    };
  });
}

export function formatDraftPickLabel(round: number, pickInRound: number) {
  return `${round}.${String(pickInRound).padStart(2, "0")}`;
}

export function adpFromPlayerStats(
  stats: Record<string, number | null> | null | undefined,
): number | null {
  if (!stats) return null;
  return getAdp(stats);
}
