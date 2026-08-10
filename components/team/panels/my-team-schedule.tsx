import { TeamScheduleList } from "@/components/team/team-schedule-list";
import { loadMyTeamNflContext } from "@/components/team/panels/load-my-team-nfl-context";
import type { RosterSlotConfig, ScheduleSettings } from "@/db/schema/league-seasons";
import {
  getFinalMatchupsForSeason,
  recordsFromFinalMatchups,
} from "@/lib/leagues/matchups/finals";
import {
  buildScheduleDisplayRows,
  weeklyRanksByWeekFromFinals,
} from "@/lib/leagues/schedule-display";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { getTeamSchedule } from "@/lib/queries/matchups";
import { enrichScheduleWinChances } from "@/lib/queries/schedule-win-chance";

export type MyTeamSchedulePanelProps = {
  slug: string;
  team: {
    id: string;
    slug: string | null;
  };
  season: {
    id: string;
    seasonYear: number;
    benchSlots: number;
    irEnabled: boolean;
    irSlots: number;
    taxiEnabled: boolean;
    taxiSlots: number;
    settings: {
      rosterSlots: RosterSlotConfig[];
      irEligibleStatuses?: string[];
      schedule?: ScheduleSettings | null;
    };
  };
  scoringRules: ScoringRuleDefinition[];
};

export async function MyTeamSchedulePanel({
  slug,
  team,
  season,
  scoringRules,
}: MyTeamSchedulePanelProps) {
  const [{ nflWeek, nflSeason, scoreboard }, scheduleRows] = await Promise.all([
    loadMyTeamNflContext({
      seasonYear: season.seasonYear,
      schedule: season.settings.schedule,
    }),
    getTeamSchedule(season.id, team.id),
  ]);

  const weekRangeByNumber = new Map(
    (scoreboard?.weeks ?? []).map((week) => [week.number, week.rangeLabel]),
  );

  const [winChances, finals] = await Promise.all([
    scheduleRows.length > 0
      ? enrichScheduleWinChances({
          focusTeamId: team.id,
          schedule: scheduleRows,
          rosterSlots: season.settings.rosterSlots,
          benchSlots: season.benchSlots,
          irEnabled: season.irEnabled,
          irSlots: season.irSlots,
          irEligibleStatuses: season.settings.irEligibleStatuses,
          taxiEnabled: season.taxiEnabled,
          taxiSlots: season.taxiSlots,
          seasonYear: nflSeason,
          currentWeek: nflWeek,
          scoringRules,
          scoreboardGames: scoreboard?.games ?? [],
        }).catch(() => new Map<string, number | null>())
      : Promise.resolve(new Map<string, number | null>()),
    getFinalMatchupsForSeason(season.id).catch(() => []),
  ]);

  const scheduleDisplayRows = buildScheduleDisplayRows({
    rows: scheduleRows,
    weekRangeByNumber,
    records: recordsFromFinalMatchups(finals),
    winChances,
    weeklyRanksByWeek: weeklyRanksByWeekFromFinals(finals, team.id),
  });

  return (
    <TeamScheduleList
      rows={scheduleDisplayRows}
      leagueSlug={slug}
      myTeamSlug={team.slug ?? null}
    />
  );
}
