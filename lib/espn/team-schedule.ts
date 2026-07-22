import { cache } from "react";

import {
  normalizeNflTeamAbbrev,
} from "@/lib/nfl/matchups";

const ESPN_TEAM_SCHEDULE =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";

/** ESPN numeric team ids keyed by Fantasy Kings / Sleeper abbrev. */
const ESPN_TEAM_IDS: Record<string, string> = {
  ARI: "22",
  ATL: "1",
  BAL: "33",
  BUF: "2",
  CAR: "29",
  CHI: "3",
  CIN: "4",
  CLE: "5",
  DAL: "6",
  DEN: "7",
  DET: "8",
  GB: "9",
  HOU: "34",
  IND: "11",
  JAX: "30",
  KC: "12",
  LAC: "24",
  LAR: "14",
  LV: "13",
  MIA: "15",
  MIN: "16",
  NE: "17",
  NO: "18",
  NYG: "19",
  NYJ: "20",
  PHI: "21",
  PIT: "23",
  SEA: "26",
  SF: "25",
  TB: "27",
  TEN: "10",
  WAS: "28",
};

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
 * Missing weeks (bye) are filled as BYE when `byeWeek` is known, else omitted
 * weeks become BYE when only one gap exists.
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
    const bye =
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

    const rows: NflTeamScheduleWeek[] = [];
    for (let week = 1; week <= 18; week++) {
      const fromSchedule = byWeek.get(week);
      const opponent = fromSchedule ?? (bye === week ? "BYE" : "—");
      rows.push({ week, opponent });
    }

    return rows;
  },
);
