import type { PlayoffSettings } from "@/db/schema/league-seasons";
import {
  CHAMPIONSHIP_WEEKS,
  getFirstRoundByes,
  getPlayoffWeekRange,
  getRegularSeasonEndWeek,
  isValidSeasonCalendar,
  PLAYOFF_TEAM_COUNTS,
  type PlayoffCalendarOptions,
} from "@/lib/leagues/season-calendar";

export const DEFAULT_PLAYOFF_SETTINGS: PlayoffSettings = {
  enabled: true,
  reSeedAfterEachRound: true,
  twoWeekChampionship: false,
};

export type PlayoffSettingsFormValues = {
  enabled: boolean;
  playoffTeamCount: (typeof PLAYOFF_TEAM_COUNTS)[number];
  championshipWeek: (typeof CHAMPIONSHIP_WEEKS)[number];
  reSeedAfterEachRound: boolean;
  twoWeekChampionship: boolean;
};

export function resolvePlayoffSettings(
  stored?: PlayoffSettings | null,
): PlayoffSettings {
  return {
    enabled: stored?.enabled ?? DEFAULT_PLAYOFF_SETTINGS.enabled,
    reSeedAfterEachRound:
      stored?.reSeedAfterEachRound ??
      DEFAULT_PLAYOFF_SETTINGS.reSeedAfterEachRound,
    twoWeekChampionship:
      stored?.twoWeekChampionship ??
      DEFAULT_PLAYOFF_SETTINGS.twoWeekChampionship,
  };
}

export function toPlayoffCalendarOptions(
  settings: PlayoffSettings,
): PlayoffCalendarOptions {
  return {
    enabled: settings.enabled,
    twoWeekChampionship: settings.twoWeekChampionship,
  };
}

export function playoffTeamCountsForLeague(teamCount: number) {
  return PLAYOFF_TEAM_COUNTS.filter((count) => count <= teamCount);
}

export function clampPlayoffTeamCount(
  playoffTeamCount: number,
  teamCount: number,
): (typeof PLAYOFF_TEAM_COUNTS)[number] {
  const options = playoffTeamCountsForLeague(teamCount);
  if (options.includes(playoffTeamCount as (typeof PLAYOFF_TEAM_COUNTS)[number])) {
    return playoffTeamCount as (typeof PLAYOFF_TEAM_COUNTS)[number];
  }
  return options[options.length - 1] ?? 4;
}

export function derivePlayoffSummary(input: {
  enabled: boolean;
  playoffTeamCount: number;
  championshipWeek: number;
  twoWeekChampionship: boolean;
}) {
  const options = {
    enabled: input.enabled,
    twoWeekChampionship: input.twoWeekChampionship,
  };
  const regularSeasonEndWeek = getRegularSeasonEndWeek(
    input.championshipWeek,
    input.playoffTeamCount,
    options,
  );
  const range = getPlayoffWeekRange(
    input.championshipWeek,
    input.playoffTeamCount,
    options,
  );

  return {
    regularSeasonEndWeek,
    firstRoundByes: input.enabled
      ? getFirstRoundByes(input.playoffTeamCount)
      : 0,
    playoffWeeksLabel: range
      ? `${range.startWeek} – ${range.endWeek}`
      : "None",
    playoffStartWeek: range?.startWeek ?? null,
    playoffEndWeek: range?.endWeek ?? null,
  };
}

export function parsePlayoffSettingsForm(input: {
  enabled: boolean;
  playoffTeamCount: number;
  championshipWeek: number;
  reSeedAfterEachRound: boolean;
  twoWeekChampionship: boolean;
  teamCount: number;
}):
  | { ok: true; values: PlayoffSettingsFormValues; regularSeasonEndWeek: number }
  | { ok: false; error: string } {
  if (
    !CHAMPIONSHIP_WEEKS.includes(
      input.championshipWeek as (typeof CHAMPIONSHIP_WEEKS)[number],
    )
  ) {
    return { ok: false, error: "Invalid championship week." };
  }

  const playoffTeamCount = clampPlayoffTeamCount(
    input.playoffTeamCount,
    input.teamCount,
  );

  const options = {
    enabled: input.enabled,
    twoWeekChampionship: input.enabled ? input.twoWeekChampionship : false,
  };

  if (
    !isValidSeasonCalendar(input.championshipWeek, playoffTeamCount, options)
  ) {
    return {
      ok: false,
      error: "Invalid championship week for this playoff format.",
    };
  }

  if (input.enabled && playoffTeamCount > input.teamCount) {
    return {
      ok: false,
      error: "Playoff teams cannot exceed league size.",
    };
  }

  return {
    ok: true,
    values: {
      enabled: input.enabled,
      playoffTeamCount,
      championshipWeek:
        input.championshipWeek as (typeof CHAMPIONSHIP_WEEKS)[number],
      reSeedAfterEachRound: input.enabled
        ? input.reSeedAfterEachRound
        : DEFAULT_PLAYOFF_SETTINGS.reSeedAfterEachRound,
      twoWeekChampionship: input.enabled ? input.twoWeekChampionship : false,
    },
    regularSeasonEndWeek: getRegularSeasonEndWeek(
      input.championshipWeek,
      playoffTeamCount,
      options,
    ),
  };
}
