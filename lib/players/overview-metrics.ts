import { resolveLeagueSeasonMaxWeek } from "@/lib/leagues/season-calendar";
import {
  getProjectionHighlightStats,
  getProjectionStatAccentTone,
  type ProjectionHighlightStat,
  type ProjectionProfileInput,
} from "@/lib/players/projection-highlights";
import {
  difficultyFromPositionSosRank,
  summarizeSosSchedule,
  type SosScheduleSummary,
} from "@/lib/players/sos-thresholds";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { explainPlayerPoints } from "@/lib/leagues/scoring/calculate";
import { getGameSiteRoof } from "@/lib/nfl/stadiums";

/** Profile fields needed to derive Overview metrics. */
export type PlayerOverviewInput = ProjectionProfileInput & {
  id?: string;
  fullName?: string;
  nflTeam?: string | null;
  sleeperId?: string | null;
  season: string;
  byeWeek: number | null;
  gameLog: {
    week: number;
    opponent: string | null;
    fantasyPts: number | null;
    stats?: Record<string, number | null>;
  }[];
  /** Optional seed for sections that need team/league context (mocks or future queries). */
  overviewExtras?: OverviewExtrasSeed | null;
};

export type OverviewVenue = "home" | "away";

export type OverviewWeekPoint = {
  week: number;
  opponent: string | null;
  opponentAbbrev: string | null;
  fpts: number | null;
  isBye: boolean;
  /** Past week with no score while later weeks are scored (injury / inactive). */
  isDnp: boolean;
  venue: OverviewVenue | null;
};

export type OverviewScoringSegment = {
  id: string;
  label: string;
  points: number;
  pct: number;
};

export type OverviewScoringArchetypeId =
  | "workhorse"
  | "three_down"
  | "td_dependent"
  | "change_of_pace"
  | "yardage_engine"
  | "ppr_cushioned"
  | "design_rush"
  | "yardage_te"
  | "red_zone_te"
  | "occasional_rush"
  | "pocket_passer"
  | "dual_threat"
  | "long_range"
  | "xp_driven"
  | "volume_kicker";

export type OverviewScoringArchetype = {
  id: OverviewScoringArchetypeId;
  label: string;
  reason: string;
};

export type OverviewFloorCeiling = {
  floor: number;
  median: number;
  ceiling: number;
  boomPct: number;
  bustPct: number;
  best: { fpts: number; opponent: string | null };
  worst: { fpts: number; opponent: string | null };
  sampleSize: number;
  /** Position median fantasy points per game (benchmark). */
  positionMedian: number | null;
  positionMedianLabel: string;
  /** Weekly fantasy-point consistency (0–100 from CV). */
  consistencyScore: number;
  consistencyLabel: "Steady" | "Mostly steady" | "Mixed" | "Volatile";
  /** Typical weekly swing (sample stdev). */
  consistencyStdev: number;
  consistencySummary: string;
};

export type OverviewSplitRow = {
  label: string;
  detail: string;
  games: number;
  fptsPerGame: number | null;
};

export type OverviewHomeAway = {
  home: OverviewSplitRow;
  away: OverviewSplitRow;
  delta: number | null;
};

export type OverviewRestImpact = {
  offBye: OverviewSplitRow;
  normal: OverviewSplitRow;
  delta: number | null;
};

export type OverviewOutdoorIndoor = {
  outdoor: OverviewSplitRow;
  indoor: OverviewSplitRow;
  delta: number | null;
};

export type OverviewShareKind = "target" | "carry" | "pass" | "fg" | "kick";

export type OverviewKickBreakdown = {
  fgMade: number;
  fgMissed: number;
  xpMade: number;
  xpMissed: number;
};

export type OverviewShare = {
  kind: OverviewShareKind;
  label: string;
  playerPct: number;
  playerTotal: number;
  teamTotal: number;
  /** 100 waffle cells; true = attributed to this player. */
  cells: boolean[];
  /** Present for overall kick rate — FG/XP made vs missed. */
  kickBreakdown?: OverviewKickBreakdown;
};

export type OverviewFgBracketRate = {
  id: string;
  /** Short axis label, e.g. "40–49". */
  label: string;
  made: number;
  attempts: number;
  /** 0–100 make rate; 0 when no attempts. */
  pct: number;
  /** League-average make rate for this bracket (0–100). */
  leagueAvgPct: number;
};

export type OverviewKickWeeklyMake = {
  week: number;
  label: string;
  /** Combined FG + XP makes. */
  made: number;
  fgMade: number;
  xpMade: number;
};

/** DEF points-allowed game counts by score bracket (radar). */
export type OverviewPtsAllowBracket = {
  id: string;
  /** Axis label, e.g. "0–3". */
  label: string;
  /** Games in this bracket for the team. */
  games: number;
  /** Share of scored games in this bracket (0–100). */
  pct: number;
  /** DEF position-average share for this bracket (0–100). */
  leagueAvgPct: number;
  /** Expected games at position-average rate for the same sample size. */
  leagueAvgGames: number;
};

/** Weekly points allowed for the DEF Points Allowed line chart. */
export type OverviewPtsAllowWeekly = {
  week: number;
  label: string;
  value: number;
  opponentTick: string | null;
};

export type OverviewEfficiencyFormat = "percent" | "decimal";

/** Real-player efficiency companion to opportunity share. */
export type OverviewEfficiency = {
  id: string;
  label: string;
  value: number;
  format: OverviewEfficiencyFormat;
  decimals: number;
  /** Supporting count line, e.g. "72 / 108". */
  detail: string;
  /** Position-average benchmark for the meter. */
  positionAvg: number | null;
  positionAvgLabel: string;
  /** Per-game efficiency for the spark/line chart. */
  weekly: {
    week: number;
    label: string;
    value: number;
    opponentTick: string | null;
  }[];
};

export type OverviewWeeklyFinish = {
  averageFinish: number;
  medianFinish: number;
  bestFinish: number;
  worstFinish: number;
  /**
   * Typical startable cutoff at this position (WR/RB 24, TE/QB 12).
   * Used for the weekly-finish barometer.
   */
  startableThreshold: number;
  /** Weeks finishing ≤ startableThreshold. */
  startableFinishes: number;
  /** Scored weeks with a finish rank. */
  games: number;
  weeks: { week: number; finish: number; fpts: number | null }[];
};

export type OverviewMatchupBucketId = "easy" | "mid" | "hard";

export type OverviewMatchupBucketOpponent = {
  week: number;
  abbrev: string;
  /** Compact matchup label for tooltips, e.g. `vsMIA` / `@PIT`. */
  label: string;
  matchupRank: number | null;
  ptsAllowed: number | null;
};

export type OverviewMatchupBucket = {
  id: OverviewMatchupBucketId;
  label: string;
  games: number;
  fptsPerGame: number | null;
  opponents: OverviewMatchupBucketOpponent[];
};

export type OverviewSosWeek = {
  week: number;
  label: string;
  opponent: string | null;
  abbrev: string | null;
  venue: OverviewVenue | null;
  difficulty: OverviewMatchupBucketId | null;
  /** 1 = easy … 3 = hard (legacy bucket axis). */
  rating: number | null;
  /** 1 = hardest … 32 = easiest. */
  matchupRank: number | null;
  /**
   * Skill: FPts allowed to this position / game.
   * DEF: opponent offense NFL points scored / game.
   */
  ptsAllowed: number | null;
  fpts: number | null;
  isBye: boolean;
  isPlayoff: boolean;
};

export type OverviewMatchupDifficulty = {
  buckets: OverviewMatchupBucket[];
  /** Weekly SOS series for the schedule wheel. */
  weeks: OverviewSosWeek[];
  /** Mean matchup rank across non-bye weeks. */
  averageMatchupRank: number | null;
  /** Overall slate read, e.g. "Typically average schedule". */
  scheduleSummary: SosScheduleSummary | null;
  leagueTeamCount: number;
  playoffWeeks: number[];
};

export type OverviewVsLeader = {
  name: string;
  team: string | null;
  fptsPerGame: number;
  delta: number;
  isSelf: boolean;
};

/** Seed row for roster comparison (mates at this position). */
export type OverviewRosterCompareSeedRow = {
  id: string;
  name: string;
  nflTeam: string | null;
  sleeperId?: string | null;
  primaryPositionId: string;
  /** e.g. RB1 / Bench — null when not on your roster. */
  slotLabel: string | null;
  gamesPlayed: number;
  carrySharePct: number | null;
  ypc: number | null;
  fptsPerGame: number;
  totalFpts: number;
  homeAvg: number | null;
  awayAvg: number | null;
  floor: number | null;
  median: number | null;
  ceiling: number | null;
  consistencyScore: number | null;
  avgWeeklyFinish: number | null;
  /** 0–100 share of scored weeks at/above the position startable barometer. */
  startablePct: number | null;
  /** Mean remaining matchup rank (1 = hardest). */
  remainingSosRank: number | null;
};

/** One row in the vs-roster comparison table. */
export type OverviewRosterCompareRow = OverviewRosterCompareSeedRow & {
  isViewed: boolean;
};

export type OverviewMultiYearRow = {
  season: string;
  games: number;
  fptsPerGame: number;
  positionRank: number | null;
};

/** Seed data for Overview sections that aren't yet query-backed. */
export type OverviewExtrasSeed = {
  share: {
    kind: OverviewShareKind;
    label: string;
    playerPct: number;
    playerTotal: number;
    teamTotal: number;
  } | null;
  weeklyFinishesByWeek: Record<number, number>;
  matchupDifficultyByWeek: Record<number, OverviewMatchupBucketId>;
  /** 1 = hardest … 32 = easiest. */
  matchupRanksByWeek: Record<number, number>;
  ptsAllowedByWeek: Record<number, number>;
  playoffWeeks: number[];
  /** Last regular-season week; SOS buckets exclude later weeks. */
  regularSeasonEndWeek?: number;
  /** Your roster mates at this position (excludes the viewed player). */
  rosterCompare?: OverviewRosterCompareSeedRow[];
  /** @deprecated Prefer rosterCompare — kept for older fixtures. */
  vsLeaders?: {
    name: string;
    team: string | null;
    fptsPerGame: number;
    isSelf: boolean;
  }[];
  multiYear: OverviewMultiYearRow[];
};

export type PlayerOverviewMetrics = {
  seasonLabel: string;
  /** Display name for chart legends / tooltips. */
  playerName: string;
  primaryPositionId: string;
  gamesPlayed: number;
  fptsPerGame: number | null;
  production: ProjectionHighlightStat[];
  scoringBreakdown: {
    fptsPerGame: number | null;
    total: number;
    segments: OverviewScoringSegment[];
    /** Scoring DNA label; null when inconclusive / unsupported position. */
    archetype: OverviewScoringArchetype | null;
    /** Short usage summary for the card footer, e.g. "Volume-driven — …". */
    summary: string | null;
  };
  share: OverviewShare | null;
  efficiency: OverviewEfficiency | null;
  /** Kicker FG make rate by distance (radar). */
  fgMakeRadar: OverviewFgBracketRate[] | null;
  /** Weekly combined FG + XP makes for the Accuracy line chart. */
  kickWeeklyMakes: OverviewKickWeeklyMake[] | null;
  /** DEF points-allowed share by bracket (radar). */
  ptsAllowRadar: OverviewPtsAllowBracket[] | null;
  /** Weekly points allowed for the DEF line chart. */
  ptsAllowWeekly: OverviewPtsAllowWeekly[] | null;
  weeklyPoints: OverviewWeekPoint[];
  averageFpts: number | null;
  floorCeiling: OverviewFloorCeiling | null;
  weeklyFinish: OverviewWeeklyFinish | null;
  homeAway: OverviewHomeAway | null;
  restImpact: OverviewRestImpact | null;
  /** Kicker (and similar) venue environment split. */
  outdoorIndoor: OverviewOutdoorIndoor | null;
  matchupDifficulty: OverviewMatchupDifficulty | null;
  /** Vs your roster at this position (fantasy decision table). */
  rosterCompare: OverviewRosterCompareRow[];
  vsLeaders: OverviewVsLeader[];
  multiYear: OverviewMultiYearRow[];
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sampleStdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = mean(values);
  if (avg == null) return null;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

/** CV at/above this maps to consistency score 0. */
const CONSISTENCY_CV_CAP = 0.75;

export function buildScoringConsistency(values: number[]): {
  score: number;
  label: OverviewFloorCeiling["consistencyLabel"];
  stdev: number;
  summary: string;
} | null {
  const avg = mean(values);
  const stdev = sampleStdev(values);
  if (avg == null || stdev == null || avg === 0) return null;

  const cv = stdev / Math.abs(avg);
  const score = Math.round(
    Math.max(0, Math.min(100, 100 * (1 - cv / CONSISTENCY_CV_CAP))),
  );
  const label: OverviewFloorCeiling["consistencyLabel"] =
    score >= 80
      ? "Steady"
      : score >= 60
        ? "Mostly steady"
        : score >= 40
          ? "Mixed"
          : "Volatile";

  return {
    score,
    label,
    stdev,
    summary: `Consistency ${score} — ${label.toLowerCase()} week to week (±${stdev.toFixed(1)} pts)`,
  };
}

export function parseOpponentMeta(opponent: string | null | undefined): {
  isBye: boolean;
  venue: OverviewVenue | null;
  abbrev: string | null;
} {
  const raw = opponent?.trim() ?? "";
  if (!raw || raw === "—") {
    return { isBye: false, venue: null, abbrev: null };
  }
  if (raw.toUpperCase() === "BYE") {
    return { isBye: true, venue: null, abbrev: null };
  }
  if (raw.startsWith("@ ")) {
    return { isBye: false, venue: "away", abbrev: raw.slice(2).trim() || null };
  }
  if (raw.startsWith("vs ")) {
    return { isBye: false, venue: "home", abbrev: raw.slice(3).trim() || null };
  }
  return { isBye: false, venue: null, abbrev: raw };
}

/** Compact axis label: `@DET`, `vDET`. */
export function formatOpponentTick(
  venue: OverviewVenue | null,
  abbrev: string | null,
): string | null {
  if (!abbrev) return null;
  if (venue === "away") return `@${abbrev}`;
  if (venue === "home") return `v${abbrev}`;
  return abbrev;
}

/** Tooltip matchup label: `vsDET` / `@DET`. */
export function formatOpponentMatchupLabel(
  venue: OverviewVenue | null,
  abbrev: string | null,
): string | null {
  if (!abbrev) return null;
  if (venue === "away") return `@${abbrev}`;
  if (venue === "home") return `vs${abbrev}`;
  return abbrev;
}

function scoredWeeks(profile: PlayerOverviewInput): OverviewWeekPoint[] {
  const points = profile.gameLog.map((row) => {
    const meta = parseOpponentMeta(row.opponent);
    const hasPts =
      row.fantasyPts != null && Number.isFinite(row.fantasyPts);
    return {
      week: row.week,
      opponent: row.opponent,
      opponentAbbrev: meta.abbrev,
      fpts: hasPts ? row.fantasyPts : null,
      isBye: meta.isBye,
      isDnp: false,
      venue: meta.venue,
    };
  });
  let lastScoredWeek = 0;
  for (const point of points) {
    if (point.fpts != null && point.week > lastScoredWeek) {
      lastScoredWeek = point.week;
    }
  }
  return points.map((point) => ({
    ...point,
    isDnp:
      !point.isBye && point.fpts == null && point.week < lastScoredWeek,
  }));
}

function positionMedianBenchmark(position: string | null | undefined): {
  value: number | null;
  label: string;
} {
  switch (position) {
    case "QB":
      return { value: 18.5, label: "QB median" };
    case "RB":
      return { value: 12.5, label: "RB median" };
    case "WR":
      return { value: 11.5, label: "WR median" };
    case "TE":
      return { value: 8.5, label: "TE median" };
    case "K":
      return { value: 8.0, label: "K median" };
    case "DEF":
      return { value: 8.0, label: "DEF median" };
    default:
      return { value: null, label: "Position median" };
  }
}

function buildFloorCeiling(
  weeks: OverviewWeekPoint[],
  position: string | null | undefined,
): OverviewFloorCeiling | null {
  const scored = weeks.filter(
    (w): w is OverviewWeekPoint & { fpts: number } =>
      w.fpts != null && !w.isBye,
  );
  if (scored.length < 2) return null;

  const values = scored.map((w) => w.fpts).toSorted((a, b) => a - b);
  const median = percentile(values, 0.5);
  const floor = percentile(values, 0.15);
  const ceiling = percentile(values, 0.85);
  const boomCutoff = median * 1.25;
  const bustCutoff = median * 0.5;
  const boomPct =
    (scored.filter((w) => w.fpts >= boomCutoff).length / scored.length) * 100;
  const bustPct =
    (scored.filter((w) => w.fpts <= bustCutoff).length / scored.length) * 100;

  let best = scored[0]!;
  let worst = scored[0]!;
  for (const week of scored) {
    if (week.fpts > best.fpts) best = week;
    if (week.fpts < worst.fpts) worst = week;
  }

  const positionMedian = positionMedianBenchmark(position);
  const consistency = buildScoringConsistency(scored.map((w) => w.fpts));
  if (consistency == null) return null;

  return {
    floor,
    median,
    ceiling,
    boomPct,
    bustPct,
    best: { fpts: best.fpts, opponent: best.opponent },
    worst: { fpts: worst.fpts, opponent: worst.opponent },
    sampleSize: scored.length,
    positionMedian: positionMedian.value,
    positionMedianLabel: positionMedian.label,
    consistencyScore: consistency.score,
    consistencyLabel: consistency.label,
    consistencyStdev: consistency.stdev,
    consistencySummary: consistency.summary,
  };
}

function buildHomeAway(weeks: OverviewWeekPoint[]): OverviewHomeAway | null {
  const homeVals = weeks
    .filter((w) => w.venue === "home" && w.fpts != null)
    .map((w) => w.fpts!);
  const awayVals = weeks
    .filter((w) => w.venue === "away" && w.fpts != null)
    .map((w) => w.fpts!);
  if (homeVals.length === 0 && awayVals.length === 0) return null;

  const homeAvg = mean(homeVals);
  const awayAvg = mean(awayVals);
  return {
    home: {
      label: "Home",
      detail: "Home games",
      games: homeVals.length,
      fptsPerGame: homeAvg,
    },
    away: {
      label: "Away",
      detail: "Road games",
      games: awayVals.length,
      fptsPerGame: awayAvg,
    },
    delta:
      homeAvg != null && awayAvg != null ? homeAvg - awayAvg : null,
  };
}

function buildRestImpact(
  weeks: OverviewWeekPoint[],
  byeWeek: number | null,
): OverviewRestImpact | null {
  if (byeWeek == null || byeWeek < 1) return null;

  const offByeWeek = byeWeek + 1;
  const offByeVals = weeks
    .filter((w) => w.week === offByeWeek && w.fpts != null && !w.isBye)
    .map((w) => w.fpts!);
  const normalVals = weeks
    .filter(
      (w) =>
        w.fpts != null &&
        !w.isBye &&
        w.week !== offByeWeek &&
        w.week !== byeWeek,
    )
    .map((w) => w.fpts!);

  if (offByeVals.length === 0 && normalVals.length === 0) return null;

  const offByeAvg = mean(offByeVals);
  const normalAvg = mean(normalVals);
  return {
    offBye: {
      label: "Off bye",
      detail: "2+ week gap",
      games: offByeVals.length,
      fptsPerGame: offByeAvg,
    },
    normal: {
      label: "Normal",
      detail: "7-day turnaround",
      games: normalVals.length,
      fptsPerGame: normalAvg,
    },
    delta:
      offByeAvg != null && normalAvg != null
        ? offByeAvg - normalAvg
        : null,
  };
}

const RB_SCORING_BUCKETS = [
  { id: "rush_yd", label: "Rush yards", keys: ["rush_yd"] },
  { id: "rush_td", label: "Rush TDs", keys: ["rush_td"] },
  { id: "rec", label: "Receptions", keys: ["rec"] },
  { id: "rec_yd", label: "Rec yards", keys: ["rec_yd"] },
  { id: "rec_td", label: "Rec TDs", keys: ["rec_td"] },
] as const;

/** WR/TE fantasy DNA — receiving first, then opportunistic rush. */
const RECEIVER_SCORING_BUCKETS = [
  { id: "rec_yd", label: "Receiving yards", keys: ["rec_yd"] },
  { id: "rec", label: "Receptions", keys: ["rec"] },
  { id: "rec_td", label: "Receiving touchdowns", keys: ["rec_td"] },
  { id: "rush_yd", label: "Rushing yards", keys: ["rush_yd"] },
  { id: "rush_td", label: "Rushing touchdowns", keys: ["rush_td"] },
] as const;

/** QB fantasy DNA — passing first, then rush. */
const QB_SCORING_BUCKETS = [
  { id: "pass_yd", label: "Passing yards", keys: ["pass_yd"] },
  { id: "pass_td", label: "Passing touchdowns", keys: ["pass_td"] },
  { id: "rush_yd", label: "Rushing yards", keys: ["rush_yd"] },
  { id: "rush_td", label: "Rushing touchdowns", keys: ["rush_td"] },
] as const;

/** K fantasy DNA — FG distance + extras (built via buildKickerScoringSegments). */

/** DEF fantasy DNA — forced buckets (tackles may score 0 under default rules). */
const DEF_SCORING_BUCKETS = [
  { id: "sack", label: "Sacks", keys: ["sack"] },
  { id: "tkl_solo", label: "Tackles", keys: ["tkl_solo"] },
  { id: "int", label: "Interceptions", keys: ["int"] },
  { id: "ff", label: "Forced fumbles", keys: ["ff"] },
  { id: "def_td", label: "Touchdowns", keys: ["def_td"] },
] as const;

type ScoringBucketDef = {
  id: string;
  label: string;
  keys: readonly string[];
};

type BucketedScoringId = string;

function bucketForStatKey(
  statKey: string | null,
  buckets: readonly ScoringBucketDef[],
): BucketedScoringId {
  if (!statKey) return "other";
  for (const bucket of buckets) {
    if (bucket.keys.includes(statKey)) return bucket.id;
  }
  return "other";
}

/**
 * Typical startable cutoff by position (how many you'd start in a common lineup).
 * WR/RB start 2 → 24; TE/QB start 1 → 12.
 */
export function positionStartableThreshold(positionId: string): number {
  switch (positionId) {
    case "WR":
    case "RB":
      return 24;
    case "TE":
    case "QB":
    case "K":
    case "DEF":
      return 12;
    default:
      return 12;
  }
}

function segmentPct(points: number, total: number): number {
  return total > 0 ? (points / total) * 100 : 0;
}

/** Mean of scored weekly fantasy points — source of truth for Overview PPG. */
function weeklyMeanFpts(profile: PlayerOverviewInput): number | null {
  const scored = scoredWeeks(profile)
    .filter((w) => w.fpts != null)
    .map((w) => w.fpts!);
  return mean(scored);
}

function scoredGameLogWeeksWithStats(profile: PlayerOverviewInput) {
  return profile.gameLog.filter(
    (row) =>
      row.fantasyPts != null &&
      Number.isFinite(row.fantasyPts) &&
      row.stats != null &&
      Object.keys(row.stats).length > 0,
  );
}

function fptsPerGameFromProfile(
  profile: PlayerOverviewInput,
  seasonPts: number | null,
  total: number,
): number | null {
  const weekly = weeklyMeanFpts(profile);
  if (weekly != null) return weekly;

  const bag =
    profile.seasonStats?.stats ?? profile.seasonProjection?.stats ?? null;
  const gp = Math.max(
    1,
    typeof bag?.gp === "number" && bag.gp > 0 ? bag.gp : 17,
  );
  if (seasonPts != null && Number.isFinite(seasonPts)) {
    return seasonPts / gp;
  }
  return total > 0 ? total / gp : null;
}

function buildRuleScoringSegments(
  profile: PlayerOverviewInput,
  rules: ScoringRuleDefinition[],
): {
  fptsPerGame: number | null;
  total: number;
  segments: OverviewScoringSegment[];
} {
  const bag =
    profile.seasonStats?.stats ??
    profile.seasonProjection?.stats ??
    null;
  const seasonPts =
    profile.seasonStats?.fantasyPts ??
    profile.seasonProjection?.fantasyPts ??
    null;

  if (!bag) {
    return { fptsPerGame: null, total: 0, segments: [] };
  }

  const explained = explainPlayerPoints(
    bag,
    profile.primaryPositionId,
    rules,
  );
  const total = explained.total || Math.abs(seasonPts ?? 0);
  const sorted = explained.lines.toSorted((a, b) => b.points - a.points);
  const top = sorted.slice(0, 5);
  const topSum = top.reduce((s, l) => s + l.points, 0);
  const other = total - topSum;
  const segments: OverviewScoringSegment[] = top.map((line) => ({
    id: line.id,
    label: line.label,
    points: line.points,
    pct: segmentPct(line.points, total),
  }));
  if (Math.abs(other) >= 0.05) {
    segments.push({
      id: "other",
      label: "Other",
      points: Math.round(other * 100) / 100,
      pct: segmentPct(other, total),
    });
  }

  return {
    fptsPerGame: fptsPerGameFromProfile(profile, seasonPts, total),
    total,
    segments,
  };
}

function buildBucketedScoringSegments(
  profile: PlayerOverviewInput,
  rules: ScoringRuleDefinition[],
  buckets: readonly ScoringBucketDef[],
): {
  fptsPerGame: number | null;
  total: number;
  segments: OverviewScoringSegment[];
} {
  const weeklyRows = scoredGameLogWeeksWithStats(profile);
  const pointsByBucket = new Map<BucketedScoringId, number>();
  let total = 0;

  if (weeklyRows.length > 0) {
    for (const row of weeklyRows) {
      const explained = explainPlayerPoints(
        row.stats!,
        profile.primaryPositionId,
        rules,
      );
      total += explained.total;
      for (const line of explained.lines) {
        const bucket = bucketForStatKey(line.statKey, buckets);
        pointsByBucket.set(
          bucket,
          (pointsByBucket.get(bucket) ?? 0) + line.points,
        );
      }
    }
    total = Math.round(total * 100) / 100;
  } else {
    const bag =
      profile.seasonStats?.stats ??
      profile.seasonProjection?.stats ??
      null;
    const seasonPts =
      profile.seasonStats?.fantasyPts ??
      profile.seasonProjection?.fantasyPts ??
      null;

    if (!bag) {
      return { fptsPerGame: null, total: 0, segments: [] };
    }

    const explained = explainPlayerPoints(
      bag,
      profile.primaryPositionId,
      rules,
    );
    total = explained.total || Math.abs(seasonPts ?? 0);
    for (const line of explained.lines) {
      const bucket = bucketForStatKey(line.statKey, buckets);
      pointsByBucket.set(
        bucket,
        (pointsByBucket.get(bucket) ?? 0) + line.points,
      );
    }
  }

  const segments: OverviewScoringSegment[] = [];
  for (const bucket of buckets) {
    const points = Math.round((pointsByBucket.get(bucket.id) ?? 0) * 100) / 100;
    if (Math.abs(points) < 0.05) continue;
    segments.push({
      id: bucket.id,
      label: bucket.label,
      points,
      pct: segmentPct(points, total),
    });
  }

  const other = Math.round((pointsByBucket.get("other") ?? 0) * 100) / 100;
  if (Math.abs(other) >= 0.05) {
    segments.push({
      id: "other",
      label: "Other",
      points: other,
      pct: segmentPct(other, total),
    });
  }

  const seasonPts =
    profile.seasonStats?.fantasyPts ??
    profile.seasonProjection?.fantasyPts ??
    total;

  return {
    fptsPerGame: fptsPerGameFromProfile(profile, seasonPts, total),
    total,
    segments,
  };
}

/**
 * Attribute DEF fantasy points into forced buckets.
 * Tackles are always listed when volume exists, even if the league scores them at 0.
 */
function buildDefScoringSegments(
  profile: PlayerOverviewInput,
  rules: ScoringRuleDefinition[],
): {
  fptsPerGame: number | null;
  total: number;
  segments: OverviewScoringSegment[];
} {
  if (scoredGameLogWeeksWithStats(profile).length > 0) {
    const base = buildBucketedScoringSegments(
      profile,
      rules,
      DEF_SCORING_BUCKETS,
    );
    const bag =
      profile.seasonStats?.stats ??
      profile.seasonProjection?.stats ??
      null;
    const tackleVol = numStat(bag ?? undefined, "tkl_solo") ?? 0;
    const hasTackle = base.segments.some((s) => s.id === "tkl_solo");
    if (tackleVol > 0 && !hasTackle) {
      const segments = [
        ...base.segments,
        {
          id: "tkl_solo",
          label: "Tackles",
          points: 0,
          pct: 0,
        },
      ];
      return { ...base, segments };
    }
    return base;
  }

  const bag =
    profile.seasonStats?.stats ??
    profile.seasonProjection?.stats ??
    null;
  const seasonPts =
    profile.seasonStats?.fantasyPts ??
    profile.seasonProjection?.fantasyPts ??
    null;

  if (!bag) {
    return { fptsPerGame: null, total: 0, segments: [] };
  }

  const scoreBag = (partial: Record<string, number | null>) =>
    explainPlayerPoints(partial, "DEF", rules).total;

  const explained = explainPlayerPoints(bag, "DEF", rules);
  const total = explained.total || Math.abs(seasonPts ?? 0);
  const candidates: OverviewScoringSegment[] = [];

  for (const bucket of DEF_SCORING_BUCKETS) {
    const key = bucket.keys[0]!;
    const volume = numStat(bag, key) ?? 0;
    const points = Math.round(scoreBag({ [key]: volume }) * 100) / 100;
    if (volume <= 0 && Math.abs(points) < 0.05) continue;
    candidates.push({
      id: bucket.id,
      label: bucket.label,
      points,
      pct: 0,
    });
  }

  const attributed = candidates.reduce((sum, s) => sum + s.points, 0);
  const other = Math.round((total - attributed) * 100) / 100;
  if (Math.abs(other) >= 0.05) {
    candidates.push({
      id: "other",
      label: "Other",
      points: other,
      pct: 0,
    });
  }

  const segments = candidates.map((segment) => ({
    ...segment,
    pct: segmentPct(segment.points, total),
  }));

  return {
    fptsPerGame: fptsPerGameFromProfile(profile, seasonPts, total),
    total,
    segments,
  };
}

function buildRbScoringSegments(
  profile: PlayerOverviewInput,
  rules: ScoringRuleDefinition[],
): {
  fptsPerGame: number | null;
  total: number;
  segments: OverviewScoringSegment[];
} {
  return buildBucketedScoringSegments(profile, rules, RB_SCORING_BUCKETS);
}

function buildReceiverScoringSegments(
  profile: PlayerOverviewInput,
  rules: ScoringRuleDefinition[],
): {
  fptsPerGame: number | null;
  total: number;
  segments: OverviewScoringSegment[];
} {
  return buildBucketedScoringSegments(profile, rules, RECEIVER_SCORING_BUCKETS);
}

function buildQbScoringSegments(
  profile: PlayerOverviewInput,
  rules: ScoringRuleDefinition[],
): {
  fptsPerGame: number | null;
  total: number;
  segments: OverviewScoringSegment[];
} {
  return buildBucketedScoringSegments(profile, rules, QB_SCORING_BUCKETS);
}

function sumStatKeys(
  bag: Record<string, number | null>,
  keys: readonly string[],
): number {
  let total = 0;
  for (const key of keys) {
    const value = bag[key];
    if (typeof value === "number" && Number.isFinite(value)) total += value;
  }
  return total;
}

/**
 * Attribute kicker fantasy points by FG distance + XP using league rules.
 * Distance bags include `fgm` so base FG rules still apply per group.
 */
function attributeKickerBag(
  bag: Record<string, number | null>,
  rules: ScoringRuleDefinition[],
  seasonPts: number | null,
): { total: number; candidates: OverviewScoringSegment[] } {
  const mid = numStat(bag, "fgm_40_49") ?? 0;
  const long = numStat(bag, "fgm_50p") ?? 0;
  const shortFromBuckets = sumStatKeys(bag, [
    "fgm_0_19",
    "fgm_20_29",
    "fgm_30_39",
  ]);
  const fgmTotal = numStat(bag, "fgm");
  const short =
    shortFromBuckets > 0
      ? shortFromBuckets
      : Math.max(0, (fgmTotal ?? 0) - mid - long);

  const scoreBag = (partial: Record<string, number | null>) =>
    explainPlayerPoints(partial, "K", rules).total;

  const candidates: OverviewScoringSegment[] = [];

  if (short > 0) {
    const points = scoreBag({
      fgm: short,
      fgm_0_19: numStat(bag, "fgm_0_19"),
      fgm_20_29: numStat(bag, "fgm_20_29"),
      fgm_30_39: numStat(bag, "fgm_30_39"),
    });
    if (Math.abs(points) >= 0.05) {
      candidates.push({
        id: "fg_short",
        label: "FG under 40",
        points,
        pct: 0,
      });
    }
  }
  if (mid > 0) {
    const points = scoreBag({ fgm: mid, fgm_40_49: mid });
    if (Math.abs(points) >= 0.05) {
      candidates.push({
        id: "fg_40",
        label: "FG 40–49",
        points,
        pct: 0,
      });
    }
  }
  if (long > 0) {
    const points = scoreBag({ fgm: long, fgm_50p: long });
    if (Math.abs(points) >= 0.05) {
      candidates.push({
        id: "fg_50",
        label: "FG 50+",
        points,
        pct: 0,
      });
    }
  }

  if (candidates.length === 0 && fgmTotal != null && fgmTotal > 0) {
    const points = scoreBag({ fgm: fgmTotal });
    if (Math.abs(points) >= 0.05) {
      candidates.push({
        id: "fg",
        label: "Field goals",
        points,
        pct: 0,
      });
    }
  }

  const xpm = numStat(bag, "xpm");
  if (xpm != null && xpm !== 0) {
    const points = scoreBag({ xpm });
    if (Math.abs(points) >= 0.05) {
      candidates.push({
        id: "xp",
        label: "Extra points",
        points,
        pct: 0,
      });
    }
  }

  const explained = explainPlayerPoints(bag, "K", rules);
  const total = explained.total || Math.abs(seasonPts ?? 0);
  const attributed = candidates.reduce((sum, s) => sum + s.points, 0);
  const other = Math.round((total - attributed) * 100) / 100;
  if (Math.abs(other) >= 0.05) {
    candidates.push({
      id: "other",
      label: "Other",
      points: other,
      pct: 0,
    });
  }

  return { total, candidates };
}

function buildKickerScoringSegments(
  profile: PlayerOverviewInput,
  rules: ScoringRuleDefinition[],
): {
  fptsPerGame: number | null;
  total: number;
  segments: OverviewScoringSegment[];
} {
  const bag =
    profile.seasonStats?.stats ??
    profile.seasonProjection?.stats ??
    null;
  const seasonPts =
    profile.seasonStats?.fantasyPts ??
    profile.seasonProjection?.fantasyPts ??
    null;

  const seasonHasDistance =
    bag != null &&
    ((numStat(bag, "fgm_40_49") ?? 0) > 0 ||
      (numStat(bag, "fgm_50p") ?? 0) > 0 ||
      sumStatKeys(bag, ["fgm_0_19", "fgm_20_29", "fgm_30_39"]) > 0);

  /** Prefer season bag for FG-distance DNA when present; weekly bags often omit brackets. */
  if (!seasonHasDistance) {
    const weeklyRows = scoredGameLogWeeksWithStats(profile);
    if (weeklyRows.length > 0) {
      const pointsById = new Map<string, { label: string; points: number }>();
      let total = 0;
      for (const row of weeklyRows) {
        const { total: weekTotal, candidates } = attributeKickerBag(
          row.stats!,
          rules,
          row.fantasyPts,
        );
        total += weekTotal;
        for (const candidate of candidates) {
          const prev = pointsById.get(candidate.id);
          if (prev) {
            prev.points += candidate.points;
          } else {
            pointsById.set(candidate.id, {
              label: candidate.label,
              points: candidate.points,
            });
          }
        }
      }
      total = Math.round(total * 100) / 100;
      const segments: OverviewScoringSegment[] = [...pointsById.entries()]
        .map(([id, row]) => ({
          id,
          label: row.label,
          points: Math.round(row.points * 100) / 100,
          pct: segmentPct(row.points, total),
        }))
        .filter((s) => Math.abs(s.points) >= 0.05 || s.id === "other");
      return {
        fptsPerGame: fptsPerGameFromProfile(profile, seasonPts ?? total, total),
        total,
        segments,
      };
    }
  }

  if (!bag) {
    return { fptsPerGame: null, total: 0, segments: [] };
  }

  const { total, candidates } = attributeKickerBag(bag, rules, seasonPts);
  const segments = candidates.map((segment) => ({
    ...segment,
    pct: segmentPct(segment.points, total),
  }));

  return {
    fptsPerGame: fptsPerGameFromProfile(profile, seasonPts, total),
    total,
    segments,
  };
}

function pctOfSegments(
  segments: OverviewScoringSegment[],
  ids: string[],
): number {
  return segments
    .filter((s) => ids.includes(s.id))
    .reduce((sum, s) => sum + s.pct, 0);
}

/** Classify RB scoring DNA from buckets + usage. */
export function classifyRbScoringArchetype(input: {
  segments: OverviewScoringSegment[];
  rushAtt: number | null;
  recTgt: number | null;
  receptions: number | null;
  gamesPlayed: number;
  carrySharePct: number | null;
}): OverviewScoringArchetype | null {
  const gp = Math.max(1, input.gamesPlayed);
  const rushAtt = input.rushAtt ?? 0;
  const recTgt = input.recTgt ?? 0;
  const receptions = input.receptions ?? 0;
  const rushAttPerGame = rushAtt / gp;
  const tgtPerGame = recTgt / gp;
  const touchesPerGame = (rushAtt + receptions) / gp;
  const tgtPerCarry = rushAtt > 0 ? recTgt / rushAtt : 0;
  const carryShare = input.carrySharePct;

  const rushYdPct = pctOfSegments(input.segments, ["rush_yd"]);
  const receivingPct = pctOfSegments(input.segments, ["rec", "rec_yd", "rec_td"]);
  const tdPct = pctOfSegments(input.segments, ["rush_td", "rec_td"]);
  const recOnlyPct = pctOfSegments(input.segments, ["rec", "rec_yd"]);

  // Workhorse: early-down volume + team rush share.
  if (
    (carryShare != null && carryShare >= 55 && rushAttPerGame >= 12) ||
    (carryShare == null && rushAttPerGame >= 18 && receivingPct < 30)
  ) {
    return {
      id: "workhorse",
      label: "Workhorse",
      reason:
        carryShare != null
          ? `${Math.round(carryShare)}% carry share · ${rushAttPerGame.toFixed(1)} att/g`
          : `${rushAttPerGame.toFixed(1)} rush att/g`,
    };
  }

  // Change-of-pace / receiving back: elevated target rate vs carries (not targets > carries).
  if (
    tgtPerCarry >= 0.35 &&
    tgtPerGame >= 3.5 &&
    receivingPct >= 30 &&
    rushAttPerGame <= 14
  ) {
    return {
      id: "change_of_pace",
      label: "Change-of-pace back",
      reason: `${tgtPerCarry.toFixed(2)} targets/carry · ${receivingPct.toFixed(0)}% receiving pts`,
    };
  }

  // Three-down: meaningful rush + receiving fantasy contribution.
  if (
    rushYdPct >= 20 &&
    receivingPct >= 20 &&
    (tgtPerGame >= 3 || recOnlyPct >= 15)
  ) {
    return {
      id: "three_down",
      label: "Three-down back",
      reason: `${rushYdPct.toFixed(0)}% rush yards · ${receivingPct.toFixed(0)}% receiving`,
    };
  }

  // TD dependent: scoring leans on TDs with lighter touch volume.
  if (tdPct >= 35 && touchesPerGame < 14) {
    return {
      id: "td_dependent",
      label: "Touchdown dependent",
      reason: `${tdPct.toFixed(0)}% from TDs · ${touchesPerGame.toFixed(1)} touches/g`,
    };
  }

  return null;
}

/** Short scoring-DNA blurb for the Overview footer. */
export function buildRbScoringSummary(input: {
  archetype: OverviewScoringArchetype | null;
  segments: OverviewScoringSegment[];
}): string | null {
  const yardagePct = pctOfSegments(input.segments, ["rush_yd", "rec_yd"]);
  const tdPct = pctOfSegments(input.segments, ["rush_td", "rec_td"]);
  const receivingPct = pctOfSegments(input.segments, [
    "rec",
    "rec_yd",
    "rec_td",
  ]);
  const maxPct = input.segments.reduce(
    (max, segment) => Math.max(max, segment.pct),
    0,
  );

  switch (input.archetype?.id) {
    case "workhorse":
      return `Volume-driven — ${Math.round(yardagePct)}% from yardage, a sturdy weekly floor`;
    case "three_down":
      return "Balanced profile — rush and receiving both carry the scoring mix";
    case "change_of_pace":
      return `Pass-catching back — ${Math.round(receivingPct)}% of fantasy points from receiving`;
    case "td_dependent":
      return `Touchdown dependent — ${Math.round(tdPct)}% of fantasy points from TDs`;
    default:
      break;
  }

  if (input.segments.length === 0) return null;

  if (maxPct < 40 && input.segments.length >= 3) {
    return "Balanced profile — no single source dominates the scoring mix";
  }

  if (tdPct >= 35) {
    return `Touchdown dependent — ${Math.round(tdPct)}% of fantasy points from TDs`;
  }

  if (yardagePct >= 55) {
    return `Volume-driven — ${Math.round(yardagePct)}% from yardage`;
  }

  if (receivingPct >= 45) {
    return `Pass-catching lean — ${Math.round(receivingPct)}% from receiving`;
  }

  return null;
}

function maxSegmentPct(segments: OverviewScoringSegment[]): number {
  return segments.reduce((max, segment) => Math.max(max, segment.pct), 0);
}

/** Classify WR/TE scoring DNA from bucket mix. */
export function classifyReceiverScoringArchetype(input: {
  positionId: "WR" | "TE";
  segments: OverviewScoringSegment[];
}): OverviewScoringArchetype | null {
  const recPct = pctOfSegments(input.segments, ["rec"]);
  const recYdPct = pctOfSegments(input.segments, ["rec_yd"]);
  const recTdPct = pctOfSegments(input.segments, ["rec_td"]);
  const rushPct = pctOfSegments(input.segments, ["rush_yd", "rush_td"]);
  const tdPct = pctOfSegments(input.segments, ["rec_td", "rush_td"]);
  const isTe = input.positionId === "TE";

  if (isTe) {
    if (rushPct >= 10) {
      return {
        id: "occasional_rush",
        label: "Occasional rush",
        reason: `${rushPct.toFixed(0)}% from the ground`,
      };
    }
    if (recTdPct >= 28 || tdPct >= 35) {
      return {
        id: "red_zone_te",
        label: "Red-zone TE",
        reason:
          recTdPct >= 28
            ? `${recTdPct.toFixed(0)}% from receiving touchdowns`
            : `${tdPct.toFixed(0)}% from touchdowns`,
      };
    }
    if (recPct >= 35) {
      return {
        id: "ppr_cushioned",
        label: "PPR-cushioned",
        reason: `catches alone supply ${recPct.toFixed(0)}%`,
      };
    }
    if (recYdPct >= 40) {
      return {
        id: "yardage_te",
        label: "Yardage TE",
        reason: `${recYdPct.toFixed(0)}% from receiving yards`,
      };
    }
    return null;
  }

  if (rushPct >= 15) {
    return {
      id: "design_rush",
      label: "Design rush",
      reason: `${rushPct.toFixed(0)}% of points from carries`,
    };
  }
  if (tdPct >= 35) {
    return {
      id: "td_dependent",
      label: "TD-dependent",
      reason: `${tdPct.toFixed(0)}% of production rides on touchdowns`,
    };
  }
  if (recPct >= 30) {
    return {
      id: "ppr_cushioned",
      label: "PPR-cushioned",
      reason: `catches alone supply ${recPct.toFixed(0)}%`,
    };
  }
  if (recYdPct >= 45) {
    return {
      id: "yardage_engine",
      label: "Yardage engine",
      reason: `${recYdPct.toFixed(0)}% from receiving yards`,
    };
  }
  return null;
}

/** Short scoring-DNA blurb for WR/TE Overview footer. */
export function buildReceiverScoringSummary(input: {
  positionId: "WR" | "TE";
  archetype: OverviewScoringArchetype | null;
  segments: OverviewScoringSegment[];
}): string | null {
  const recPct = pctOfSegments(input.segments, ["rec"]);
  const recYdPct = pctOfSegments(input.segments, ["rec_yd"]);
  const recTdPct = pctOfSegments(input.segments, ["rec_td"]);
  const rushPct = pctOfSegments(input.segments, ["rush_yd", "rush_td"]);
  const tdPct = pctOfSegments(input.segments, ["rec_td", "rush_td"]);
  const maxPct = maxSegmentPct(input.segments);
  const isTe = input.positionId === "TE";

  switch (input.archetype?.id) {
    case "design_rush":
      return `Design rush — ${Math.round(rushPct)}% of points from carries`;
    case "occasional_rush":
      return `Occasional rush — ${Math.round(rushPct)}% from the ground`;
    case "td_dependent":
      return `TD-dependent — ${Math.round(tdPct)}% of production rides on touchdowns`;
    case "red_zone_te":
      return recTdPct >= 28
        ? `Red-zone TE — ${Math.round(recTdPct)}% from receiving touchdowns`
        : `Red-zone TE — ${Math.round(tdPct)}% from touchdowns`;
    case "ppr_cushioned":
      return `PPR-cushioned — catches alone supply ${Math.round(recPct)}%`;
    case "yardage_engine":
      return `Yardage engine — ${Math.round(recYdPct)}% from receiving yards`;
    case "yardage_te":
      return `Yardage TE — ${Math.round(recYdPct)}% from receiving yards`;
    default:
      break;
  }

  if (input.segments.length === 0) return null;

  if (maxPct < 40 && input.segments.length >= 3) {
    return "Balanced profile — no single source dominates the scoring mix";
  }

  if (tdPct >= 35) {
    return `TD-dependent — ${Math.round(tdPct)}% of production rides on touchdowns`;
  }

  if (recPct >= (isTe ? 35 : 30)) {
    return `PPR-cushioned — catches alone supply ${Math.round(recPct)}%`;
  }

  if (recYdPct >= (isTe ? 40 : 45)) {
    return isTe
      ? `Yardage TE — ${Math.round(recYdPct)}% from receiving yards`
      : `Yardage engine — ${Math.round(recYdPct)}% from receiving yards`;
  }

  return null;
}

/** Classify QB scoring DNA from pass/rush bucket mix. */
export function classifyQbScoringArchetype(input: {
  segments: OverviewScoringSegment[];
}): OverviewScoringArchetype | null {
  const passYdPct = pctOfSegments(input.segments, ["pass_yd"]);
  const rushPct = pctOfSegments(input.segments, ["rush_yd", "rush_td"]);
  const tdPct = pctOfSegments(input.segments, ["pass_td", "rush_td"]);

  if (tdPct >= 40) {
    return {
      id: "td_dependent",
      label: "TD-dependent",
      reason: `${tdPct.toFixed(0)}% of production rides on touchdowns`,
    };
  }
  if (rushPct >= 25) {
    return {
      id: "dual_threat",
      label: "Dual-threat",
      reason: `${rushPct.toFixed(0)}% of points from rushing`,
    };
  }
  if (passYdPct >= 45 && rushPct < 20) {
    return {
      id: "pocket_passer",
      label: "Pocket passer",
      reason: `${passYdPct.toFixed(0)}% from passing yards`,
    };
  }
  return null;
}

/** Short scoring-DNA blurb for QB Overview footer. */
export function buildQbScoringSummary(input: {
  archetype: OverviewScoringArchetype | null;
  segments: OverviewScoringSegment[];
}): string | null {
  const passYdPct = pctOfSegments(input.segments, ["pass_yd"]);
  const rushPct = pctOfSegments(input.segments, ["rush_yd", "rush_td"]);
  const tdPct = pctOfSegments(input.segments, ["pass_td", "rush_td"]);
  const maxPct = maxSegmentPct(input.segments);

  switch (input.archetype?.id) {
    case "dual_threat":
      return `Dual-threat — ${Math.round(rushPct)}% of points from rushing`;
    case "td_dependent":
      return `TD-dependent — ${Math.round(tdPct)}% of production rides on touchdowns`;
    case "pocket_passer":
      return `Pocket passer — ${Math.round(passYdPct)}% from passing yards`;
    default:
      break;
  }

  if (input.segments.length === 0) return null;

  if (maxPct < 40 && input.segments.length >= 3) {
    return "Balanced profile — no single source dominates the scoring mix";
  }

  if (tdPct >= 40) {
    return `TD-dependent — ${Math.round(tdPct)}% of production rides on touchdowns`;
  }

  if (rushPct >= 25) {
    return `Dual-threat — ${Math.round(rushPct)}% of points from rushing`;
  }

  if (passYdPct >= 45) {
    return `Volume passer — ${Math.round(passYdPct)}% from passing yards`;
  }

  return null;
}

/** Classify K scoring DNA from FG distance + XP mix. */
export function classifyKickerScoringArchetype(input: {
  segments: OverviewScoringSegment[];
}): OverviewScoringArchetype | null {
  const longPct = pctOfSegments(input.segments, ["fg_50"]);
  const xpPct = pctOfSegments(input.segments, ["xp"]);
  const fgPct = pctOfSegments(input.segments, [
    "fg_short",
    "fg_40",
    "fg_50",
    "fg",
  ]);

  if (longPct >= 30) {
    return {
      id: "long_range",
      label: "Long-range",
      reason: `${longPct.toFixed(0)}% from 50+ yard field goals`,
    };
  }
  if (xpPct >= 40) {
    return {
      id: "xp_driven",
      label: "XP-driven",
      reason: `${xpPct.toFixed(0)}% from extra points`,
    };
  }
  if (fgPct >= 55) {
    return {
      id: "volume_kicker",
      label: "Volume kicker",
      reason: `${fgPct.toFixed(0)}% from field goals`,
    };
  }
  return null;
}

/** Short scoring-DNA blurb for K Overview footer. */
export function buildKickerScoringSummary(input: {
  archetype: OverviewScoringArchetype | null;
  segments: OverviewScoringSegment[];
}): string | null {
  const longPct = pctOfSegments(input.segments, ["fg_50"]);
  const xpPct = pctOfSegments(input.segments, ["xp"]);
  const fgPct = pctOfSegments(input.segments, [
    "fg_short",
    "fg_40",
    "fg_50",
    "fg",
  ]);
  const maxPct = maxSegmentPct(input.segments);

  switch (input.archetype?.id) {
    case "long_range":
      return `Long-range — ${Math.round(longPct)}% from 50+ yard field goals`;
    case "xp_driven":
      return `XP-driven — ${Math.round(xpPct)}% from extra points`;
    case "volume_kicker":
      return `Volume kicker — ${Math.round(fgPct)}% from field goals`;
    default:
      break;
  }

  if (input.segments.length === 0) return null;

  if (maxPct < 40 && input.segments.length >= 3) {
    return "Balanced profile — no single source dominates the scoring mix";
  }

  if (longPct >= 30) {
    return `Long-range — ${Math.round(longPct)}% from 50+ yard field goals`;
  }

  if (xpPct >= 40) {
    return `XP-driven — ${Math.round(xpPct)}% from extra points`;
  }

  if (fgPct >= 55) {
    return `Volume kicker — ${Math.round(fgPct)}% from field goals`;
  }

  return null;
}

/** Short scoring-DNA blurb for DEF Overview footer. */
export function buildDefScoringSummary(input: {
  segments: OverviewScoringSegment[];
}): string | null {
  if (input.segments.length === 0) return null;

  const sackPct = pctOfSegments(input.segments, ["sack"]);
  const tacklePct = pctOfSegments(input.segments, ["tkl_solo"]);
  const turnoverPct = pctOfSegments(input.segments, ["int", "ff"]);
  const tdPct = pctOfSegments(input.segments, ["def_td"]);
  const maxPct = maxSegmentPct(input.segments);

  if (sackPct >= 40) {
    return `Pass-rush — ${Math.round(sackPct)}% of points from sacks`;
  }
  if (turnoverPct >= 35) {
    return `Takeaway unit — ${Math.round(turnoverPct)}% from INTs and forced fumbles`;
  }
  if (tdPct >= 30) {
    return `Score-driven — ${Math.round(tdPct)}% from defensive touchdowns`;
  }
  if (tacklePct >= 35) {
    return `Tackle-heavy — ${Math.round(tacklePct)}% from solo tackles`;
  }
  if (maxPct < 40 && input.segments.filter((s) => s.id !== "other").length >= 3) {
    return "Balanced profile — no single source dominates the scoring mix";
  }

  return null;
}

function buildScoringBreakdown(
  profile: PlayerOverviewInput,
  rules: ScoringRuleDefinition[],
): PlayerOverviewMetrics["scoringBreakdown"] {
  const position = profile.primaryPositionId;
  const isRb = position === "RB";
  const isReceiver = position === "WR" || position === "TE";
  const isQb = position === "QB";
  const isK = position === "K";
  const isDef = position === "DEF";
  const base = isRb
    ? buildRbScoringSegments(profile, rules)
    : isReceiver
      ? buildReceiverScoringSegments(profile, rules)
      : isQb
        ? buildQbScoringSegments(profile, rules)
        : isK
          ? buildKickerScoringSegments(profile, rules)
          : isDef
            ? buildDefScoringSegments(profile, rules)
            : buildRuleScoringSegments(profile, rules);

  if (isReceiver) {
    const positionId = position as "WR" | "TE";
    const archetype = classifyReceiverScoringArchetype({
      positionId,
      segments: base.segments,
    });
    return {
      ...base,
      archetype,
      summary: buildReceiverScoringSummary({
        positionId,
        archetype,
        segments: base.segments,
      }),
    };
  }

  if (isQb) {
    const archetype = classifyQbScoringArchetype({ segments: base.segments });
    return {
      ...base,
      archetype,
      summary: buildQbScoringSummary({
        archetype,
        segments: base.segments,
      }),
    };
  }

  if (isK) {
    const archetype = classifyKickerScoringArchetype({
      segments: base.segments,
    });
    return {
      ...base,
      archetype,
      summary: buildKickerScoringSummary({
        archetype,
        segments: base.segments,
      }),
    };
  }

  if (isDef) {
    return {
      ...base,
      archetype: null,
      summary: buildDefScoringSummary({ segments: base.segments }),
    };
  }

  if (!isRb) {
    return { ...base, archetype: null, summary: null };
  }

  const stats =
    profile.seasonStats?.stats ?? profile.seasonProjection?.stats ?? undefined;
  const carryShare =
    profile.overviewExtras?.share?.kind === "carry"
      ? profile.overviewExtras.share.playerPct
      : null;
  const gamesPlayed = Math.max(
    1,
    scoredWeeks(profile).filter((w) => w.fpts != null).length ||
      (typeof stats?.gp === "number" && stats.gp > 0 ? stats.gp : 1),
  );

  const archetype = classifyRbScoringArchetype({
    segments: base.segments,
    rushAtt: numStat(stats, "rush_att"),
    recTgt: numStat(stats, "rec_tgt"),
    receptions: numStat(stats, "rec"),
    gamesPlayed,
    carrySharePct: carryShare,
  });

  return {
    ...base,
    archetype,
    summary: buildRbScoringSummary({ archetype, segments: base.segments }),
  };
}

function buildShare(
  seed: OverviewExtrasSeed["share"] | null | undefined,
): OverviewShare | null {
  if (!seed || seed.playerPct < 0) return null;
  const filled = Math.max(0, Math.min(100, Math.round(seed.playerPct)));
  const cells = Array.from({ length: 100 }, (_, i) => i < filled);
  return {
    kind: seed.kind,
    label: seed.label,
    playerPct: seed.playerPct,
    playerTotal: seed.playerTotal,
    teamTotal: seed.teamTotal,
    cells,
  };
}

/** Overall kick rate (FG + XP makes / attempts) for the Accuracy headline. */
function buildKickerKickShare(
  profile: PlayerOverviewInput,
): OverviewShare | null {
  const stats =
    profile.seasonStats?.stats ?? profile.seasonProjection?.stats ?? undefined;
  const fgm = numStat(stats, "fgm") ?? 0;
  const fga = numStat(stats, "fga");
  const xpm = numStat(stats, "xpm") ?? 0;
  const xpa = numStat(stats, "xpa");

  const fgAttempts =
    fga != null && fga > 0
      ? fga
      : fgm +
        sumStatKeys(stats ?? {}, [
          "fgmiss_0_19",
          "fgmiss_20_29",
          "fgmiss_30_39",
          "fgmiss_40_49",
          "fgmiss_50p",
        ]);
  const xpAttempts =
    xpa != null && xpa > 0
      ? xpa
      : xpm + (numStat(stats, "xpmiss") ?? 0);

  const makes = fgm + xpm;
  const attempts = fgAttempts + xpAttempts;
  if (attempts <= 0) return null;

  const playerPct = (makes / attempts) * 100;
  const filled = Math.max(0, Math.min(100, Math.round(playerPct)));
  const fgMissed = Math.max(0, fgAttempts - fgm);
  const xpMissed = Math.max(0, xpAttempts - xpm);

  return {
    kind: "kick",
    label: "Kick make rate",
    playerPct,
    playerTotal: Math.round(makes),
    teamTotal: Math.round(attempts),
    cells: Array.from({ length: 100 }, (_, i) => i < filled),
    kickBreakdown: {
      fgMade: Math.round(fgm),
      fgMissed: Math.round(fgMissed),
      xpMade: Math.round(xpm),
      xpMissed: Math.round(xpMissed),
    },
  };
}

const FG_BRACKETS = [
  {
    id: "0_19",
    label: "<20",
    madeKey: "fgm_0_19",
    missKey: "fgmiss_0_19",
    /** Typical NFL make rate for this distance. */
    leagueAvgPct: 99,
  },
  {
    id: "20_29",
    label: "20–29",
    madeKey: "fgm_20_29",
    missKey: "fgmiss_20_29",
    leagueAvgPct: 97,
  },
  {
    id: "30_39",
    label: "30–39",
    madeKey: "fgm_30_39",
    missKey: "fgmiss_30_39",
    leagueAvgPct: 94,
  },
  {
    id: "40_49",
    label: "40–49",
    madeKey: "fgm_40_49",
    missKey: "fgmiss_40_49",
    leagueAvgPct: 82,
  },
  {
    id: "50p",
    label: "50+",
    madeKey: "fgm_50p",
    missKey: "fgmiss_50p",
    leagueAvgPct: 68,
  },
] as const;

/** FG make rate by yardage for the Accuracy radar. */
function buildKickerFgMakeRadar(
  profile: PlayerOverviewInput,
): OverviewFgBracketRate[] | null {
  const stats =
    profile.seasonStats?.stats ?? profile.seasonProjection?.stats ?? undefined;
  if (!stats) return null;

  const brackets = FG_BRACKETS.map((bracket) => {
    const made = numStat(stats, bracket.madeKey) ?? 0;
    const missed = numStat(stats, bracket.missKey) ?? 0;
    const attempts = made + missed;
    return {
      id: bracket.id,
      label: bracket.label,
      made: Math.round(made),
      attempts: Math.round(attempts),
      pct: attempts > 0 ? (made / attempts) * 100 : 0,
      leagueAvgPct: bracket.leagueAvgPct,
    };
  });

  if (brackets.every((b) => b.attempts === 0)) return null;
  return brackets;
}

/** Weekly combined FG + XP makes for the Accuracy line chart. */
function buildKickerWeeklyMakes(
  profile: PlayerOverviewInput,
): OverviewKickWeeklyMake[] | null {
  const rows: OverviewKickWeeklyMake[] = [];
  for (const row of profile.gameLog) {
    if (parseOpponentMeta(row.opponent).isBye) continue;
    const bag = row.stats ?? {};
    const fgMade = numStat(bag, "fgm") ?? 0;
    const xpMade = numStat(bag, "xpm") ?? 0;
    if (
      row.fantasyPts == null &&
      fgMade === 0 &&
      xpMade === 0 &&
      numStat(bag, "fga") == null &&
      numStat(bag, "xpa") == null
    ) {
      continue;
    }
    rows.push({
      week: row.week,
      label: `W${row.week}`,
      made: fgMade + xpMade,
      fgMade,
      xpMade,
    });
  }
  return rows.length > 0 ? rows : null;
}

/** Typical DEF share of games by NFL points-allowed bracket (sums to 100). */
const PTS_ALLOW_BRACKETS = [
  { id: "0_7", label: "0–7", min: 0, max: 7, leagueAvgPct: 12 },
  { id: "8_10", label: "8–10", min: 8, max: 10, leagueAvgPct: 10 },
  { id: "11_14", label: "11–14", min: 11, max: 14, leagueAvgPct: 22 },
  { id: "15_21", label: "15–21", min: 15, max: 21, leagueAvgPct: 35 },
  { id: "22p", label: "22+", min: 22, max: Infinity, leagueAvgPct: 21 },
] as const;

/** Typical NFL team DEF points allowed per game (benchmark for weekly line). */
export const DEF_LEAGUE_PA_PER_WEEK = 21;

function ptsAllowBracketId(ptsAllow: number): string {
  for (const bracket of PTS_ALLOW_BRACKETS) {
    if (ptsAllow >= bracket.min && ptsAllow <= bracket.max) {
      return bracket.id;
    }
  }
  return "22p";
}

/** Game counts by points-allowed bracket for the DEF radar. */
function buildPtsAllowRadar(
  profile: PlayerOverviewInput,
): OverviewPtsAllowBracket[] | null {
  const counts = new Map<string, number>();
  for (const bracket of PTS_ALLOW_BRACKETS) {
    counts.set(bracket.id, 0);
  }

  let scored = 0;
  for (const row of profile.gameLog) {
    if (parseOpponentMeta(row.opponent).isBye) continue;
    const ptsAllow = numStat(row.stats, "pts_allow");
    if (ptsAllow == null || !Number.isFinite(ptsAllow)) continue;
    const id = ptsAllowBracketId(ptsAllow);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    scored += 1;
  }

  if (scored === 0) {
    return null;
  }

  return PTS_ALLOW_BRACKETS.map((bracket) => {
    const games = counts.get(bracket.id) ?? 0;
    const leagueAvgGames =
      Math.round(((bracket.leagueAvgPct / 100) * scored) * 10) / 10;
    return {
      id: bracket.id,
      label: bracket.label,
      games,
      pct: (games / scored) * 100,
      leagueAvgPct: bracket.leagueAvgPct,
      leagueAvgGames,
    };
  });
}

/** Weekly points allowed for the DEF Points Allowed line chart. */
function buildPtsAllowWeekly(
  profile: PlayerOverviewInput,
): OverviewPtsAllowWeekly[] | null {
  const rows: OverviewPtsAllowWeekly[] = [];
  for (const row of profile.gameLog) {
    const meta = parseOpponentMeta(row.opponent);
    if (meta.isBye) continue;
    const ptsAllow = numStat(row.stats, "pts_allow");
    if (ptsAllow == null || !Number.isFinite(ptsAllow)) continue;
    rows.push({
      week: row.week,
      label: `W${row.week}`,
      value: ptsAllow,
      opponentTick: formatOpponentTick(meta.venue, meta.abbrev),
    });
  }
  return rows.length > 0 ? rows : null;
}

function buildOutdoorIndoor(
  weeks: OverviewWeekPoint[],
  playerTeam: string | null | undefined,
): OverviewOutdoorIndoor | null {
  const outdoorVals: number[] = [];
  const indoorVals: number[] = [];

  for (const week of weeks) {
    if (week.fpts == null || week.isBye) continue;
    const roof = getGameSiteRoof({
      playerTeam,
      venue: week.venue,
      opponentAbbrev: week.opponentAbbrev,
    });
    if (roof === "outdoor") outdoorVals.push(week.fpts);
    if (roof === "indoor") indoorVals.push(week.fpts);
  }

  if (outdoorVals.length === 0 && indoorVals.length === 0) return null;

  const outdoorAvg = mean(outdoorVals);
  const indoorAvg = mean(indoorVals);
  return {
    outdoor: {
      label: "Outdoors",
      detail: "Open-air stadiums",
      games: outdoorVals.length,
      fptsPerGame: outdoorAvg,
    },
    indoor: {
      label: "Indoors",
      detail: "Dome / retractable",
      games: indoorVals.length,
      fptsPerGame: indoorAvg,
    },
    delta:
      outdoorAvg != null && indoorAvg != null
        ? outdoorAvg - indoorAvg
        : null,
  };
}

function numStat(
  stats: Record<string, number | null> | undefined,
  key: string,
): number | null {
  const value = stats?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Opportunity-efficiency companion:
 * WR/TE catch rate, RB yards/carry, QB completion %.
 */
function buildEfficiency(
  profile: PlayerOverviewInput,
): OverviewEfficiency | null {
  const stats =
    profile.seasonStats?.stats ?? profile.seasonProjection?.stats ?? undefined;
  const position = profile.primaryPositionId;

  const weeklyFrom = (
    compute: (bag: Record<string, number | null>) => number | null,
  ) =>
    profile.gameLog.flatMap((row) => {
      const meta = parseOpponentMeta(row.opponent);
      if (meta.isBye) return [];
      const value = compute(row.stats ?? {});
      if (value == null) return [];
      return [
        {
          week: row.week,
          label: `W${row.week}`,
          value,
          opponentTick: formatOpponentTick(meta.venue, meta.abbrev),
        },
      ];
    });

  if (position === "WR" || position === "TE") {
    const rec = numStat(stats, "rec");
    const tgt = numStat(stats, "rec_tgt");
    if (rec == null || tgt == null || tgt <= 0) return null;
    return {
      id: "catch_rate",
      label: "Catch rate",
      value: (rec / tgt) * 100,
      format: "percent",
      decimals: 0,
      detail: `${Math.round(rec)} / ${Math.round(tgt)}`,
      positionAvg: position === "TE" ? 68 : 62,
      positionAvgLabel: `${position} avg`,
      weekly: weeklyFrom((bag) => {
        const wRec = numStat(bag, "rec");
        const wTgt = numStat(bag, "rec_tgt");
        if (wRec == null || wTgt == null || wTgt <= 0) return null;
        return (wRec / wTgt) * 100;
      }),
    };
  }

  if (position === "RB") {
    const yards = numStat(stats, "rush_yd");
    const att = numStat(stats, "rush_att");
    if (yards == null || att == null || att <= 0) return null;
    return {
      id: "ypc",
      label: "Yards per carry",
      value: yards / att,
      format: "decimal",
      decimals: 1,
      detail: `${Math.round(yards)} yds · ${Math.round(att)} att`,
      positionAvg: 4.2,
      positionAvgLabel: "RB avg",
      weekly: weeklyFrom((bag) => {
        const wYd = numStat(bag, "rush_yd");
        const wAtt = numStat(bag, "rush_att");
        if (wYd == null || wAtt == null || wAtt <= 0) return null;
        return wYd / wAtt;
      }),
    };
  }

  if (position === "QB") {
    const cmp = numStat(stats, "pass_cmp");
    const att = numStat(stats, "pass_att");
    if (cmp == null || att == null || att <= 0) return null;
    return {
      id: "comp_pct",
      label: "Completion %",
      value: (cmp / att) * 100,
      format: "percent",
      decimals: 1,
      detail: `${Math.round(cmp)} / ${Math.round(att)}`,
      positionAvg: 64.5,
      positionAvgLabel: "QB avg",
      weekly: weeklyFrom((bag) => {
        const wCmp = numStat(bag, "pass_cmp");
        const wAtt = numStat(bag, "pass_att");
        if (wCmp == null || wAtt == null || wAtt <= 0) return null;
        return (wCmp / wAtt) * 100;
      }),
    };
  }

  return null;
}

function buildWeeklyFinish(
  weeks: OverviewWeekPoint[],
  finishesByWeek: Record<number, number> | undefined,
  positionId: string,
): OverviewWeeklyFinish | null {
  if (!finishesByWeek) return null;
  const rows = weeks
    .filter((w) => !w.isBye && finishesByWeek[w.week] != null)
    .map((w) => ({
      week: w.week,
      finish: finishesByWeek[w.week]!,
      fpts: w.fpts,
    }));
  if (rows.length === 0) return null;

  const startableThreshold = positionStartableThreshold(positionId);
  const finishes = rows.map((r) => r.finish).toSorted((a, b) => a - b);
  const averageFinish =
    finishes.reduce((a, b) => a + b, 0) / finishes.length;
  const medianFinish = percentile(finishes, 0.5);
  const bestFinish = Math.min(...finishes);
  const worstFinish = Math.max(...finishes);
  const startableFinishes = rows.filter(
    (r) => r.finish <= startableThreshold,
  ).length;

  return {
    averageFinish,
    medianFinish,
    bestFinish,
    worstFinish,
    startableThreshold,
    startableFinishes,
    games: rows.length,
    weeks: rows,
  };
}

const BUCKET_LABELS: Record<OverviewMatchupBucketId, string> = {
  easy: "Easy",
  mid: "Average",
  hard: "Hard",
};

const BUCKET_RATING: Record<OverviewMatchupBucketId, number> = {
  easy: 1,
  mid: 2,
  hard: 3,
};

function buildMatchupDifficulty(
  weeks: OverviewWeekPoint[],
  extras: OverviewExtrasSeed | null | undefined,
  positionId: string,
): OverviewMatchupDifficulty | null {
  const byWeek = extras?.matchupDifficultyByWeek;
  const ranks = extras?.matchupRanksByWeek;
  const ptsAllowed = extras?.ptsAllowedByWeek;
  const playoffWeeks = extras?.playoffWeeks ?? [];
  if (!byWeek && !ranks && !ptsAllowed) return null;

  const regularSeasonEndWeek =
    extras?.regularSeasonEndWeek ??
    (playoffWeeks.length > 0 ? Math.min(...playoffWeeks) - 1 : null);

  const dataWeeks = [
    ...weeks.map((w) => w.week),
    ...Object.keys(ranks ?? {}).map(Number),
    ...Object.keys(byWeek ?? {}).map(Number),
    ...Object.keys(ptsAllowed ?? {}).map(Number),
    ...playoffWeeks,
    ...(regularSeasonEndWeek != null ? [regularSeasonEndWeek] : []),
  ];
  const dataMax = dataWeeks.length > 0 ? Math.max(...dataWeeks) : 0;
  /** League slate = regular season through championship / last playoff week. */
  const seasonCap = resolveLeagueSeasonMaxWeek({
    regularSeasonEndWeek,
    playoffWeeks,
  });
  const maxWeek = Math.max(seasonCap > 0 ? seasonCap : dataMax, 1);

  const playoffWeekSet = new Set(playoffWeeks);
  const byWeekNumber = new Map(weeks.map((w) => [w.week, w]));
  const sosWeeks: OverviewSosWeek[] = [];
  for (let week = 1; week <= maxWeek; week++) {
    const existing = byWeekNumber.get(week);
    const rank = ranks?.[week] ?? null;
    const allowed = ptsAllowed?.[week] ?? null;
    const opponent =
      existing?.opponent ??
      (existing == null &&
      rank == null &&
      allowed == null &&
      byWeek?.[week] == null
        ? "BYE"
        : null);
    const meta = parseOpponentMeta(opponent);
    const isBye = Boolean(
      existing?.isBye ||
        meta.isBye ||
        (existing == null &&
          rank == null &&
          allowed == null &&
          byWeek?.[week] == null),
    );
    const difficulty = isBye
      ? null
      : (byWeek?.[week] ??
        difficultyFromPositionSosRank(positionId, rank));
    const isPlayoff =
      playoffWeekSet.has(week) ||
      (regularSeasonEndWeek != null && week > regularSeasonEndWeek);

    sosWeeks.push({
      week,
      label: `W${week}`,
      opponent: isBye ? "BYE" : opponent,
      abbrev: existing?.opponentAbbrev ?? meta.abbrev,
      venue: existing?.venue ?? meta.venue,
      difficulty,
      rating: !difficulty ? null : BUCKET_RATING[difficulty],
      matchupRank: isBye ? null : rank,
      ptsAllowed: isBye ? null : allowed,
      fpts: existing?.fpts ?? null,
      isBye,
      isPlayoff,
    });
  }

  const buckets: OverviewMatchupBucket[] = (
    ["easy", "mid", "hard"] as const
  ).map((id) => {
    /** Every non-bye slate week in this tier (playoffs included — matches donut). */
    const matched = sosWeeks.filter(
      (w) => !w.isBye && w.difficulty === id,
    );
    const allowedValues = matched
      .map((w) => w.ptsAllowed)
      .filter((n): n is number => n != null && Number.isFinite(n));
    const opponents = matched.flatMap((w) => {
      if (!w.abbrev) return [];
      const label = formatOpponentMatchupLabel(w.venue, w.abbrev);
      if (!label) return [];
      return [
        {
          week: w.week,
          abbrev: w.abbrev,
          label,
          matchupRank: w.matchupRank,
          ptsAllowed: w.ptsAllowed,
        },
      ];
    });
    return {
      id,
      label: BUCKET_LABELS[id],
      games: matched.length,
      /** Mean rate for opponents in this bucket (allowed/G or opp PPG for DEF). */
      fptsPerGame: mean(allowedValues),
      opponents,
    };
  });

  const ranked = sosWeeks
    .filter((w) => !w.isBye && w.matchupRank != null)
    .map((w) => w.matchupRank!);
  const averageMatchupRank = mean(ranked);

  if (
    buckets.every((b) => b.games === 0) &&
    sosWeeks.every((w) => w.matchupRank == null && !w.difficulty)
  ) {
    return null;
  }

  const leagueTeamCount = 32;
  return {
    buckets,
    weeks: sosWeeks,
    averageMatchupRank,
    scheduleSummary: summarizeSosSchedule(
      averageMatchupRank,
      positionId,
      leagueTeamCount,
    ),
    leagueTeamCount,
    playoffWeeks:
      playoffWeeks.length > 0
        ? playoffWeeks
        : sosWeeks.filter((w) => w.isPlayoff).map((w) => w.week),
  };
}

function buildVsLeaders(
  seed: OverviewExtrasSeed["vsLeaders"] | undefined,
): OverviewVsLeader[] {
  if (!seed || seed.length === 0) return [];
  const self = seed.find((r) => r.isSelf);
  const selfPpg = self?.fptsPerGame ?? null;
  return seed.map((row) => ({
    name: row.name,
    team: row.team,
    fptsPerGame: row.fptsPerGame,
    isSelf: row.isSelf,
    delta: selfPpg != null ? row.fptsPerGame - selfPpg : 0,
  }));
}

function remainingSosFromMatchups(
  matchup: OverviewMatchupDifficulty | null,
  afterWeek: number,
): number | null {
  if (!matchup) return null;
  const ranks = matchup.weeks
    .filter(
      (w) =>
        w.week > afterWeek &&
        !w.isBye &&
        !w.isPlayoff &&
        w.matchupRank != null,
    )
    .map((w) => w.matchupRank!);
  return mean(ranks);
}

function buildRosterCompare(
  seed: OverviewRosterCompareSeedRow[] | undefined,
  subject: OverviewRosterCompareRow | null,
): OverviewRosterCompareRow[] {
  const mates = (seed ?? []).map((row) => ({
    ...row,
    isViewed: false as const,
  }));
  if (!subject) return mates;
  const withoutDup = mates.filter((row) => row.id !== subject.id);
  return [subject, ...withoutDup];
}

/** Build Overview tab metrics from a loaded profile + league scoring rules. */
export function buildPlayerOverviewMetrics(
  profile: PlayerOverviewInput,
  rules: ScoringRuleDefinition[],
): PlayerOverviewMetrics {
  const extras = profile.overviewExtras ?? null;
  const seasonMaxWeek = resolveLeagueSeasonMaxWeek({
    regularSeasonEndWeek: extras?.regularSeasonEndWeek,
    playoffWeeks: extras?.playoffWeeks,
  });
  const cappedProfile: PlayerOverviewInput = {
    ...profile,
    gameLog: profile.gameLog.filter((row) => row.week <= seasonMaxWeek),
  };
  const weeklyPoints = scoredWeeks(cappedProfile);
  const scoredFpts = weeklyPoints
    .filter((w) => w.fpts != null)
    .map((w) => w.fpts!);
  const gamesPlayed = scoredFpts.length;
  const averageFpts = mean(scoredFpts);

  const productionProfile: ProjectionProfileInput = {
    primaryPositionId: cappedProfile.primaryPositionId,
    positionRank: cappedProfile.positionRank,
    /** Never fall back to projections for Season Production. */
    seasonProjection: null,
    seasonStats: cappedProfile.seasonStats,
  };
  const production = cappedProfile.seasonStats
    ? getProjectionHighlightStats(productionProfile, {
        gamesPlayed,
        usePositionRankForFpts: false,
      }).map((tileStat) => {
        if (tileStat.key !== "fpts_weekly" || averageFpts == null) {
          return tileStat;
        }
        return {
          ...tileStat,
          value: averageFpts,
          label: "FPTS/G",
          accentTone: getProjectionStatAccentTone({
            key: "fpts_weekly",
            value: averageFpts,
            position: cappedProfile.primaryPositionId,
            positionRank: null,
          }),
        };
      })
    : [];

  const share =
    buildShare(extras?.share) ??
    (cappedProfile.primaryPositionId === "K"
      ? buildKickerKickShare(cappedProfile)
      : null);
  const efficiency =
    cappedProfile.primaryPositionId === "K" ||
    cappedProfile.primaryPositionId === "DEF"
      ? null
      : buildEfficiency(cappedProfile);
  const fgMakeRadar =
    cappedProfile.primaryPositionId === "K"
      ? buildKickerFgMakeRadar(cappedProfile)
      : null;
  const kickWeeklyMakes =
    cappedProfile.primaryPositionId === "K"
      ? buildKickerWeeklyMakes(cappedProfile)
      : null;
  const ptsAllowRadar =
    cappedProfile.primaryPositionId === "DEF"
      ? buildPtsAllowRadar(cappedProfile)
      : null;
  const ptsAllowWeekly =
    cappedProfile.primaryPositionId === "DEF"
      ? buildPtsAllowWeekly(cappedProfile)
      : null;
  const floorCeiling = buildFloorCeiling(
    weeklyPoints,
    cappedProfile.primaryPositionId,
  );
  const weeklyFinish = buildWeeklyFinish(
    weeklyPoints,
    extras?.weeklyFinishesByWeek,
    cappedProfile.primaryPositionId,
  );
  const homeAway = buildHomeAway(weeklyPoints);
  const outdoorIndoor =
    cappedProfile.primaryPositionId === "K"
      ? buildOutdoorIndoor(weeklyPoints, cappedProfile.nflTeam)
      : null;
  const matchupDifficulty = buildMatchupDifficulty(
    weeklyPoints,
    extras,
    cappedProfile.primaryPositionId,
  );

  const lastScoredWeek = weeklyPoints.reduce(
    (max, w) => (w.fpts != null ? Math.max(max, w.week) : max),
    0,
  );

  const subjectRow: OverviewRosterCompareRow | null =
    averageFpts != null
      ? {
          id: cappedProfile.id ?? "viewed",
          name: cappedProfile.fullName ?? "This player",
          nflTeam: cappedProfile.nflTeam ?? null,
          sleeperId: cappedProfile.sleeperId ?? null,
          primaryPositionId: cappedProfile.primaryPositionId,
          slotLabel: null,
          isViewed: true,
          gamesPlayed,
          carrySharePct:
            share?.kind === "carry" ? share.playerPct : null,
          ypc:
            efficiency?.id === "ypc" ? efficiency.value : null,
          fptsPerGame: averageFpts,
          totalFpts: scoredFpts.reduce((sum, n) => sum + n, 0),
          homeAvg: homeAway?.home.fptsPerGame ?? null,
          awayAvg: homeAway?.away.fptsPerGame ?? null,
          floor: floorCeiling?.floor ?? null,
          median: floorCeiling?.median ?? null,
          ceiling: floorCeiling?.ceiling ?? null,
          consistencyScore: floorCeiling?.consistencyScore ?? null,
          avgWeeklyFinish: weeklyFinish?.averageFinish ?? null,
          startablePct:
            weeklyFinish && weeklyFinish.games > 0
              ? (weeklyFinish.startableFinishes / weeklyFinish.games) * 100
              : null,
          remainingSosRank: remainingSosFromMatchups(
            matchupDifficulty,
            lastScoredWeek,
          ),
        }
      : null;

  return {
    seasonLabel: cappedProfile.season,
    playerName: cappedProfile.fullName?.trim() || "Player",
    primaryPositionId: cappedProfile.primaryPositionId,
    gamesPlayed,
    fptsPerGame: averageFpts,
    production,
    scoringBreakdown: buildScoringBreakdown(cappedProfile, rules),
    share,
    efficiency,
    fgMakeRadar,
    kickWeeklyMakes,
    ptsAllowRadar,
    ptsAllowWeekly,
    weeklyPoints,
    averageFpts,
    floorCeiling,
    weeklyFinish,
    homeAway,
    restImpact:
      cappedProfile.primaryPositionId === "K"
        ? null
        : buildRestImpact(weeklyPoints, cappedProfile.byeWeek),
    outdoorIndoor,
    matchupDifficulty,
    rosterCompare: buildRosterCompare(extras?.rosterCompare, subjectRow),
    vsLeaders: buildVsLeaders(extras?.vsLeaders),
    multiYear: extras?.multiYear ?? [],
  };
}
