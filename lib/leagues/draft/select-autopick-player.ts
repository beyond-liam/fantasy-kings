import "server-only";

import { asc, eq } from "drizzle-orm";

import { draftPicks, draftQueue, players } from "@/db/schema";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import {
  buildDraftSchedule,
  getDraftRounds,
} from "@/lib/leagues/draft/board";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";

type AutopickSeasonTeam = {
  id: string;
  name: string;
  draftSlot: number | null;
  autoPickEnabled: boolean;
};

/**
 * Queue-first autopick. When `queueOnly` is true, never falls back to BPA
 * (claimed seats with the manager autopick toggle). Open seats omit that flag
 * so they still take need-aware ADP when the queue is empty.
 */
export async function selectAutopickPlayerId(input: {
  draftId: string;
  currentPickIndex: number;
  teamId: string;
  seasonTeams: AutopickSeasonTeam[];
  settings: LeagueSeasonSettings;
  benchSlots: number;
  scoringPreset: string;
  /** When true, return null if the team queue has no available player. */
  queueOnly?: boolean;
}): Promise<string | null> {
  const draftSettings = resolveDraftSettings(input.settings.draft);
  const teamsWithSlots = input.seasonTeams
    .filter((team) => team.draftSlot != null)
    .map((team) => ({
      id: team.id,
      name: team.name,
      draftSlot: team.draftSlot as number,
    }));

  const rounds = getDraftRounds(input.settings.rosterSlots, input.benchSlots);
  const schedule = buildDraftSchedule({
    teams: teamsWithSlots,
    rounds,
    style: draftSettings.style,
  });

  const existingPicks = await db
    .select({
      playerId: draftPicks.playerId,
      teamId: draftPicks.teamId,
      primaryPositionId: players.primaryPositionId,
      byeWeek: players.byeWeek,
    })
    .from(draftPicks)
    .innerJoin(players, eq(players.id, draftPicks.playerId))
    .where(eq(draftPicks.draftId, input.draftId));
  const drafted = new Set(existingPicks.map((row) => row.playerId));
  const teamRoster = existingPicks
    .filter((row) => row.teamId === input.teamId)
    .map((row) => ({
      primaryPositionId: row.primaryPositionId,
      byeWeek: row.byeWeek,
    }));

  const queueRows = await db
    .select({ playerId: draftQueue.playerId })
    .from(draftQueue)
    .where(eq(draftQueue.teamId, input.teamId))
    .orderBy(asc(draftQueue.sortOrder));

  const queued =
    queueRows.find((row) => !drafted.has(row.playerId))?.playerId ?? null;
  if (queued) {
    return queued;
  }

  if (input.queueOnly) {
    return null;
  }

  const { pickNeedAwarePlayer } = await import("@/lib/draft/need-aware-pick");
  const { resolveScoringRuleDefinitions } = await import(
    "@/lib/leagues/scoring"
  );
  const { getRankedPlayers } = await import("@/lib/queries/players");
  const { getNflState } = await import("@/lib/sleeper/api");
  const nflState = await getNflState();
  const scoringPreset = input.scoringPreset as
    | "full_ppr"
    | "half_ppr"
    | "standard";
  const scoringRules = resolveScoringRuleDefinitions(
    scoringPreset,
    input.settings.scoringRules,
  );
  const ranked = await getRankedPlayers({
    season: nflState.season,
    week: 0,
    kind: "projection",
    scoringPreset,
    scoringRules,
  }).catch(() => []);

  const available = ranked
    .filter((player) => !drafted.has(player.id))
    .map((player) => ({
      id: player.id,
      fullName: player.fullName,
      primaryPositionId: player.primaryPositionId,
      nflTeam: player.nflTeam,
      stats: player.stats,
      fantasyPts: player.fantasyPts,
      byeWeek: player.byeWeek,
    }));

  const picksRemainingForTeam = schedule.filter(
    (entry, index) =>
      index >= input.currentPickIndex && entry.teamId === input.teamId,
  ).length;

  const choice = pickNeedAwarePlayer({
    available,
    draftedRoster: teamRoster,
    rosterSlots: input.settings.rosterSlots,
    scoring: scoringPreset,
    picksRemainingForTeam,
    random: () => 0,
  });
  return choice?.id ?? null;
}
