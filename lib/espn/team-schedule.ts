import { cache } from "react";

import { ESPN_TEAM_IDS } from "@/lib/espn/rosters";
import {
  NFL_PRESEASON_FIRST_WEEK,
  NFL_PRESEASON_LAST_WEEK,
} from "@/lib/leagues/schedule/fantasy-week-map";
import {
  normalizeNflTeamAbbrev,
} from "@/lib/nfl/matchups";

const ESPN_TEAM_SCHEDULE =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";

type EspnScheduleCompetitor = {
  homeAway?: string;
  score?: string | number | { value?: number; displayValue?: string } | null;
  winner?: boolean | null;
  team?: { abbreviation?: string };
};

type EspnScheduleEvent = {
  week?: { number?: number };
  seasonType?: { type?: number };
  competitions?: Array<{
    competitors?: EspnScheduleCompetitor[];
    status?: {
      type?: {
        completed?: boolean;
        state?: string;
      };
    };
  }>;
};

type EspnTeamScheduleResponse = {
  events?: EspnScheduleEvent[];
};

export type NflTeamGameResult = "W" | "L" | "T";

export type NflTeamScheduleWeek = {
  week: number;
  /** "@ KC", "vs BUF", or "BYE". */
  opponent: string;
  /** NFL team result when the game is final; null for bye/upcoming. */
  result: NflTeamGameResult | null;
};

export type NflTeamScheduleSeasonType = "pre" | "regular";

const ESPN_SEASON_TYPE = {
  pre: 1,
  regular: 2,
} as const;

function parseCompetitorScore(
  score: EspnScheduleCompetitor["score"],
): number | null {
  if (score == null || score === "") {
    return null;
  }
  if (typeof score === "number") {
    return Number.isFinite(score) ? score : null;
  }
  if (typeof score === "string") {
    const value = Number(score);
    return Number.isFinite(value) ? value : null;
  }
  if (typeof score === "object") {
    if (typeof score.value === "number" && Number.isFinite(score.value)) {
      return score.value;
    }
    if (score.displayValue != null && score.displayValue !== "") {
      const value = Number(score.displayValue);
      return Number.isFinite(value) ? value : null;
    }
  }
  return null;
}

function resolveGameResult(
  teamAbbrev: string,
  competition: NonNullable<EspnScheduleEvent["competitions"]>[number],
): NflTeamGameResult | null {
  const status = competition.status?.type;
  const isFinal =
    status?.completed === true || status?.state === "post";
  if (!isFinal) {
    return null;
  }

  const competitors = competition.competitors ?? [];
  const self = competitors.find(
    (c) =>
      normalizeNflTeamAbbrev(c.team?.abbreviation) === teamAbbrev,
  );
  const other = competitors.find(
    (c) =>
      normalizeNflTeamAbbrev(c.team?.abbreviation) !== teamAbbrev,
  );
  if (!self || !other) {
    return null;
  }

  if (self.winner === true) {
    return "W";
  }
  if (other.winner === true) {
    return "L";
  }

  const selfScore = parseCompetitorScore(self.score);
  const otherScore = parseCompetitorScore(other.score);
  if (
    selfScore != null &&
    otherScore != null &&
    selfScore === otherScore
  ) {
    return "T";
  }

  // Final but no winner flag and unequal/missing scores — treat as tie only
  // when both winners are explicitly false (ESPN tie pattern).
  if (self.winner === false && other.winner === false) {
    return "T";
  }

  return null;
}

function opponentLabel(
  teamAbbrev: string,
  competition: NonNullable<EspnScheduleEvent["competitions"]>[number],
): string | null {
  const competitors = competition.competitors ?? [];
  const self = competitors.find(
    (c) =>
      normalizeNflTeamAbbrev(c.team?.abbreviation) === teamAbbrev,
  );
  const other = competitors.find(
    (c) =>
      normalizeNflTeamAbbrev(c.team?.abbreviation) !== teamAbbrev,
  );
  const opp = normalizeNflTeamAbbrev(other?.team?.abbreviation);
  if (!opp) {
    return null;
  }
  return self?.homeAway === "home" ? `vs ${opp}` : `@ ${opp}`;
}

/**
 * Parse ESPN team-schedule events for one NFL team and season type.
 * Preseason uses ESPN weeks 2–4 (Hall of Fame week 1 is skipped).
 */
export function parseEspnTeamScheduleEvents(
  events: EspnScheduleEvent[],
  teamAbbrev: string,
  seasonType: NflTeamScheduleSeasonType,
): Map<number, { opponent: string; result: NflTeamGameResult | null }> {
  const espnType = ESPN_SEASON_TYPE[seasonType];
  const minWeek =
    seasonType === "pre" ? NFL_PRESEASON_FIRST_WEEK : 1;
  const maxWeek =
    seasonType === "pre" ? NFL_PRESEASON_LAST_WEEK : 18;
  const byWeek = new Map<
    number,
    { opponent: string; result: NflTeamGameResult | null }
  >();

  for (const event of events) {
    if (event.seasonType?.type !== espnType) {
      continue;
    }
    const week = event.week?.number;
    if (!week || week < minWeek || week > maxWeek) {
      continue;
    }
    const competition = event.competitions?.[0];
    if (!competition) {
      continue;
    }
    const label = opponentLabel(teamAbbrev, competition);
    if (label) {
      byWeek.set(week, {
        opponent: label,
        result: resolveGameResult(teamAbbrev, competition),
      });
    }
  }

  return byWeek;
}

function padRegularSeasonWeeks(
  byWeek: Map<number, { opponent: string; result: NflTeamGameResult | null }>,
  byeHint: number | null,
): NflTeamScheduleWeek[] {
  const missingWeeks: number[] = [];
  for (let week = 1; week <= 18; week++) {
    if (!byWeek.has(week)) missingWeeks.push(week);
  }
  const inferredBye =
    missingWeeks.length === 1 ? missingWeeks[0]! : null;
  const bye = byeHint ?? inferredBye;

  const rows: NflTeamScheduleWeek[] = [];
  for (let week = 1; week <= 18; week++) {
    const fromSchedule = byWeek.get(week);
    const opponent = fromSchedule?.opponent ?? (bye === week ? "BYE" : "—");
    rows.push({
      week,
      opponent,
      result: fromSchedule?.result ?? null,
    });
  }
  return rows;
}

/**
 * NFL team schedule, one ESPN request.
 * Regular season: weeks 1–18, missing weeks filled as BYE when known.
 * Preseason: ESPN weeks 2–4 only (no 18-week pad).
 */
export const getNflTeamSchedule = cache(
  async (input: {
    nflTeam: string | null | undefined;
    season: string | number;
    byeWeek?: number | null;
    seasonType?: NflTeamScheduleSeasonType;
  }): Promise<NflTeamScheduleWeek[]> => {
    const abbrev = normalizeNflTeamAbbrev(input.nflTeam);
    if (!abbrev) {
      return [];
    }

    const seasonType = input.seasonType ?? "regular";
    const teamId = ESPN_TEAM_IDS[abbrev];
    const season = Number(input.season);
    const byeHint =
      input.byeWeek != null &&
      Number.isFinite(input.byeWeek) &&
      input.byeWeek >= 1 &&
      input.byeWeek <= 18
        ? input.byeWeek
        : null;

    let byWeek = new Map<
      number,
      { opponent: string; result: NflTeamGameResult | null }
    >();

    if (teamId && Number.isFinite(season)) {
      try {
        const url = new URL(`${ESPN_TEAM_SCHEDULE}/${teamId}/schedule`);
        url.searchParams.set("season", String(season));
        url.searchParams.set("seasontype", String(ESPN_SEASON_TYPE[seasonType]));

        const response = await fetch(url, {
          next: { revalidate: 60 * 60 },
        });

        if (response.ok) {
          const payload = (await response.json()) as EspnTeamScheduleResponse;
          byWeek = parseEspnTeamScheduleEvents(
            payload.events ?? [],
            abbrev,
            seasonType,
          );
        }
      } catch {
        // Fall through to bye / placeholder rows.
      }
    }

    if (seasonType === "pre") {
      return [...byWeek.entries()]
        .toSorted((a, b) => a[0] - b[0])
        .map(([week, slot]) => ({
          week,
          opponent: slot.opponent,
          result: slot.result,
        }));
    }

    return padRegularSeasonWeeks(byWeek, byeHint);
  },
);
