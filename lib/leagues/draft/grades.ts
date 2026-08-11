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
  /** Absolute strength vs league leader (0–100). Matches power rankings. */
  score: number;
  /** Raw weighted projection strength (starters full + bench ×0.35). */
  projectedStrength: number;
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
export function weightedRosterStrength(
  fantasyPts: readonly number[],
  starterSlots: number,
): number {
  const starters = starterCount(starterSlots);
  const sorted = [...fantasyPts].sort((a, b) => b - a);
  let total = 0;
  sorted.forEach((pts, index) => {
    total += index < starters ? pts : pts * 0.35;
  });
  return total;
}

/** Higher projected pts weighted for starters; bench discounted. */
export function teamProjectedStrength(
  picks: DraftGradePickInput[],
  starterSlots: number,
): number {
  return weightedRosterStrength(
    picks.map((pick) => pick.fantasyPts ?? 0),
    starterSlots,
  );
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

/** K / DEF taken after round 8 are normal roster fills — not “worst pick”. */
export const WORST_VALUE_K_DEF_MAX_ROUND = 8;

export function isEligibleWorstValuePick(pick: DraftGradePickInput): boolean {
  const position = pick.primaryPositionId;
  if (position === "K" || position === "DEF") {
    return pick.round <= WORST_VALUE_K_DEF_MAX_ROUND;
  }
  return true;
}

function toValuePick(pick: DraftGradePickInput): DraftGradeValuePick | null {
  const value = pickAdpValue(pick);
  if (value == null || pick.adp == null) return null;
  return {
    playerId: pick.playerId,
    overall: pick.overall,
    round: pick.round,
    pickInRound: pick.pickInRound,
    adp: pick.adp,
    value,
  };
}

export function bestAndWorstValue(picks: DraftGradePickInput[]): {
  best: DraftGradeValuePick | null;
  worst: DraftGradeValuePick | null;
} {
  let best: DraftGradeValuePick | null = null;
  let worst: DraftGradeValuePick | null = null;

  for (const pick of picks) {
    const row = toValuePick(pick);
    if (!row) continue;
    if (!best || row.value > best.value) best = row;
    if (!isEligibleWorstValuePick(pick)) continue;
    if (!worst || row.value < worst.value) worst = row;
  }

  return { best, worst };
}

/** Letter from absolute strength score (leader = 100). */
export function letterFromPowerScore(score: number): DraftGradeLetter {
  const s = Number.isFinite(score) ? score : 0;
  if (s >= 97) return "A+";
  if (s >= 93) return "A";
  if (s >= 88) return "B+";
  if (s >= 82) return "B";
  if (s >= 75) return "C+";
  if (s >= 65) return "C";
  if (s >= 50) return "D";
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
      picks,
    };
  });

  const avgStrength =
    strengths.reduce((sum, row) => sum + row.strength, 0) /
    Math.max(1, strengths.length);
  const strengthSpread = Math.max(
    40,
    ...strengths.map((row) => Math.abs(row.strength - avgStrength)),
  );

  let maxStrength = 0;
  for (const row of strengths) {
    if (row.strength > maxStrength) maxStrength = row.strength;
  }

  const scored = strengths.map((row) => {
    const score =
      maxStrength <= 0 ? 0 : (100 * row.strength) / maxStrength;
    return { ...row, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.teamId.localeCompare(b.teamId);
  });

  return scored.map((row, index) => {
    const leagueRank = index + 1;
    const score = Math.round(row.score * 10) / 10;
    const letter = letterFromPowerScore(score);
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
      score,
      projectedStrength: Math.round(row.strength * 10) / 10,
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
