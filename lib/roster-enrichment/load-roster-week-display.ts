import "server-only";

import type { ScheduleSettings } from "@/db/schema/league-seasons";
import {
  loadMyTeamNflContext,
  withPlayerOpponent,
} from "@/components/team/panels/load-my-team-nfl-context";
import { overlayPlanSlots } from "@/lib/leagues/lineup-plans";
import { loadFantasyWeekLineupLockState } from "@/lib/leagues/lineup-lock-started";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";
import {
  resolveTeamSummaryMatchups,
  type TeamSummaryScheduleRow,
} from "@/lib/leagues/team-summary";
import { hasNflTeamStarted } from "@/lib/leagues/waivers/game-lock";
import { getTeamLineupPlanSlots } from "@/lib/queries/lineup-plans";
import { getTeamSchedule } from "@/lib/queries/matchups";
import { resolveTeamRosterForWeekDisplay } from "@/lib/queries/team-roster-display-cache";
import { loadRosterEnrichmentWeek } from "@/lib/roster-enrichment/load-roster-enrichment-week";
import type {
  RosterWeekDisplayPayload,
  RosterWeekPlayerPatch,
} from "@/lib/roster-enrichment/types";

export async function loadRosterWeekDisplay(input: {
  teamId: string;
  leagueSeasonId: string;
  seasonYear: number;
  schedule?: ScheduleSettings | null;
  transactionRules?: Parameters<typeof resolveTransactionRules>[0];
  scoringRules: ScoringRuleDefinition[];
  fantasyWeek: number;
  currentWeek: number;
  slotsFingerprint?: string | null;
}): Promise<RosterWeekDisplayPayload> {
  const {
    teamId,
    leagueSeasonId,
    seasonYear,
    schedule,
    transactionRules,
    scoringRules,
    fantasyWeek,
    currentWeek,
    slotsFingerprint,
  } = input;

  try {
    const [loadedRosterPlayers, nflContext, teamScheduleRows] = await Promise.all([
      resolveTeamRosterForWeekDisplay(teamId, slotsFingerprint),
      loadMyTeamNflContext({
        seasonYear,
        schedule,
        fantasyWeek,
      }),
      getTeamSchedule(leagueSeasonId, teamId),
    ]);

    const planSlots =
      fantasyWeek > currentWeek
        ? await getTeamLineupPlanSlots({
            leagueSeasonId,
            teamId,
            week: fantasyWeek,
          })
        : null;
    const rosterPlayers = planSlots
      ? overlayPlanSlots(loadedRosterPlayers, planSlots)
      : loadedRosterPlayers;

    const shells = rosterPlayers.map((player) => ({
      id: player.id,
      nflTeam: player.nflTeam,
      byeWeek: player.byeWeek,
      primaryPositionId: player.primaryPositionId,
    }));

    const weekData = await loadRosterEnrichmentWeek({
      scoringRules,
      players: shells,
      nflContext,
    });

    const { nflWeek, nflSeasonType, opponentsByTeam } = nflContext;

    const players: Record<string, RosterWeekPlayerPatch> = {};
    for (const player of rosterPlayers) {
      const enriched = withPlayerOpponent(
        {
          ...player,
          projectedPts: weekData.projectedById.get(player.id) ?? null,
          actualPts: weekData.actualById.get(player.id) ?? null,
        },
        nflWeek,
        opponentsByTeam,
        {
          seasonYear,
          seasonType: nflSeasonType,
        },
      );

      players[player.id] = {
        projectedPts: enriched.projectedPts ?? null,
        actualPts: enriched.actualPts ?? null,
        opponent: enriched.opponent ?? null,
        slotPositionId: player.slotPositionId,
      };
    }

    const summarySchedule: TeamSummaryScheduleRow[] = teamScheduleRows.map(
      (row) => ({
        week: row.week,
        publicId: row.publicId,
        opponentName: row.opponentName,
        opponentSlug: row.opponentSlug,
        isHome: row.isHome,
        status: row.status,
        teamPts: row.isHome ? row.homePts : row.awayPts,
        opponentPts: row.isHome ? row.awayPts : row.homePts,
      }),
    );
    const { previous, current } = resolveTeamSummaryMatchups(
      summarySchedule,
      fantasyWeek,
    );

    const preventCutsAfterGameStart =
      resolveTransactionRules(transactionRules).preventCutsAfterGameStart;
    const lockState =
      fantasyWeek <= currentWeek && preventCutsAfterGameStart
        ? await loadFantasyWeekLineupLockState({
            schedule,
            fantasyWeek,
            seasonYear,
          })
        : { startedNflTeams: null as Set<string> | null, slateFinalized: false };
    const gameLockedPlayerIds =
      lockState.startedNflTeams != null
        ? rosterPlayers
            .filter((player) =>
              hasNflTeamStarted(player.nflTeam, lockState.startedNflTeams!),
            )
            .map((player) => player.id)
        : [];

    return {
      ok: true,
      week: fantasyWeek,
      currentWeek,
      players,
      gameLockedPlayerIds,
      slateFinalized: lockState.slateFinalized,
      summary: { previous, current },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Roster week display failed",
    };
  }
}
