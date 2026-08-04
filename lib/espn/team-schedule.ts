import { cache } from "react";

import { ESPN_TEAM_IDS } from "@/lib/espn/rosters";
import {
  normalizeNflTeamAbbrev,
} from "@/lib/nfl/matchups";

const ESPN_TEAM_SCHEDULE =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";

type EspnScheduleCompetitor = {
  homeAway?: string;
  team?: { abbreviation?: string };
};

type EspnScheduleEvent = {
  week?: { number?: number };
  seasonType?: { type?: number };
  competitions?: Array<{
    competitors?: EspnScheduleCompetitor[];
  }>;
};

type EspnTeamScheduleResponse = {
  events?: EspnScheduleEvent[];
};

export type NflTeamScheduleWeek = {
  week: number;
  /** "@ KC", "vs BUF", or "BYE". */
  opponent: string;
};

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
 * Regular-season schedule for an NFL team (weeks 1–18), one ESPN request.
 * Missing weeks are filled as BYE when `byeWeek` is known, or when exactly
 * one week is missing from the ESPN response (inferred bye).
 */
export const getNflTeamSchedule = cache(
  async (input: {
    nflTeam: string | null | undefined;
    season: string | number;
    byeWeek?: number | null;
  }): Promise<NflTeamScheduleWeek[]> => {
    const abbrev = normalizeNflTeamAbbrev(input.nflTeam);
    if (!abbrev) {
      return [];
    }

    const teamId = ESPN_TEAM_IDS[abbrev];
    const season = Number(input.season);
    const byeHint =
      input.byeWeek != null &&
      Number.isFinite(input.byeWeek) &&
      input.byeWeek >= 1 &&
      input.byeWeek <= 18
        ? input.byeWeek
        : null;

    const byWeek = new Map<number, string>();

    if (teamId && Number.isFinite(season)) {
      try {
        const url = new URL(`${ESPN_TEAM_SCHEDULE}/${teamId}/schedule`);
        url.searchParams.set("season", String(season));

        const response = await fetch(url, {
          next: { revalidate: 60 * 60 },
        });

        if (response.ok) {
          const payload = (await response.json()) as EspnTeamScheduleResponse;

          for (const event of payload.events ?? []) {
            if (event.seasonType?.type !== 2) {
              continue;
            }
            const week = event.week?.number;
            if (!week || week < 1 || week > 18) {
              continue;
            }
            const competition = event.competitions?.[0];
            if (!competition) {
              continue;
            }
            const label = opponentLabel(abbrev, competition);
            if (label) {
              byWeek.set(week, label);
            }
          }
        }
      } catch {
        // Fall through to bye / placeholder rows.
      }
    }

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
      const opponent = fromSchedule ?? (bye === week ? "BYE" : "—");
      rows.push({ week, opponent });
    }

    return rows;
  },
);
