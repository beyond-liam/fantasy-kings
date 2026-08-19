import type { ScheduleSettings } from "@/db/schema/league-seasons";
import {
  calendarSeasonTypesForSchedule,
  type ScheduleSettingsValues,
} from "@/lib/account/schedule-settings";
import { getCachedNflScoreboard } from "@/lib/espn/scoreboard-cache";
import {
  espnSeasonTypeForNfl,
  fantasyWeekFromNflState,
  fantasyWeekToNfl,
  type NflCalendarPoint,
} from "@/lib/leagues/schedule/fantasy-week-map";
import { resolveScheduleSettings } from "@/lib/leagues/schedule/settings";
import {
  buildOpponentByTeam,
  resolvePlayerOpponent,
  withPositionalSos,
  type TeamMatchup,
} from "@/lib/nfl/matchups";
import type { PositionalSosTable } from "@/lib/players/matchup-difficulty";
import { getNflState } from "@/lib/sleeper/api";

export type MyTeamNflContextOptions = {
  /** League season year (preferred over Sleeper state when set). */
  seasonYear?: number;
  /** League schedule settings — drives preseason vs regular OPP slate. */
  schedule?: ScheduleSettings | null;
  /** Fantasy week to view. Defaults to the league’s current week. */
  fantasyWeek?: number;
};

export async function loadMyTeamNflContext(
  options: MyTeamNflContextOptions = {},
) {
  const nflState = await getNflState();
  const settings = resolveScheduleSettings(options.schedule);
  const scheduleValues: ScheduleSettingsValues = {
    includePreseason: settings.includePreseason ?? false,
    preseasonStartWeek: settings.preseasonStartWeek ?? 1,
  };

  const seasonYear =
    options.seasonYear ??
    (Number(nflState.season) || new Date().getUTCFullYear());
  const nflSeason = String(seasonYear);

  // League fantasy week → NFL calendar (respects includePreseason / start week).
  const currentFantasyWeek = fantasyWeekFromNflState(nflState, settings) ?? 1;
  const fantasyWeek = Math.max(
    1,
    options.fantasyWeek ?? currentFantasyWeek,
  );
  const nflPoint: NflCalendarPoint = fantasyWeekToNfl(fantasyWeek, settings) ?? {
    seasonType: "regular",
    week: Math.max(1, Number(nflState.display_week ?? nflState.week) || 1),
  };

  const scoreboard = await getCachedNflScoreboard({
    season: seasonYear,
    week: nflPoint.week,
    seasonType: espnSeasonTypeForNfl(nflPoint.seasonType),
    calendarSeasonTypes: calendarSeasonTypesForSchedule(scheduleValues),
  }).catch(() => null);

  const opponentsByTeam = scoreboard
    ? buildOpponentByTeam(scoreboard.games)
    : new Map<string, TeamMatchup>();

  return {
    nflState,
    fantasyWeek,
    currentFantasyWeek,
    nflWeek: nflPoint.week,
    nflSeasonType: nflPoint.seasonType,
    nflSeason,
    scoreboard,
    opponentsByTeam,
  };
}

export type MyTeamNflContext = Awaited<ReturnType<typeof loadMyTeamNflContext>>;

export function withPlayerOpponent<
  T extends {
    nflTeam: string | null;
    byeWeek: number | null;
    primaryPositionId?: string;
  },
>(
  player: T,
  nflWeek: number,
  opponentsByTeam: Map<string, TeamMatchup>,
  options?: {
    seasonYear?: number;
    seasonType?: NflCalendarPoint["seasonType"];
    sos?: PositionalSosTable | null;
  },
): T & { opponent: ReturnType<typeof resolvePlayerOpponent> } {
  const opponent = resolvePlayerOpponent({
    nflTeam: player.nflTeam,
    byeWeek: player.byeWeek,
    week: nflWeek,
    opponentsByTeam,
    seasonYear: options?.seasonYear,
    seasonType: options?.seasonType,
  });
  return {
    ...player,
    opponent: withPositionalSos(
      opponent,
      player.primaryPositionId,
      options?.sos,
    ),
  };
}
