import { and, eq, inArray, lte, sql } from "drizzle-orm";

import { leagues, leagueSeasons, matchups, teams } from "@/db/schema";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import type { ScheduleGame } from "@/lib/espn/scoreboard";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring/rules";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { ensurePlayoffMatchupsAdvanced } from "@/lib/leagues/playoffs/ensure-matchups";
import { resolvePlayoffSettings } from "@/lib/leagues/playoff-settings";
import { resolveTiebreakerSettings } from "@/lib/leagues/tiebreakers";
import { getWeekMatchups } from "@/lib/queries/matchups";
import { enrichWeekMatchupBoard } from "@/lib/queries/week-matchup-board";
import { finalizeMaxWeek } from "./finalize-gates";

export {
  getFinalMatchupsForSeason,
  getFinalMatchupsForSeasons,
  recordsFromFinalMatchups,
} from "./finals";

export type FinalizeMatchupsResult = {
  seasonsChecked: number;
  weeksChecked: number;
  finalized: number;
  inProgress: number;
  corrected: number;
  playoffAdvanceErrors: Array<{ leagueSeasonId: string; error: string }>;
};

type SeasonFinalizeRow = {
  id: string;
  seasonYear: number;
  regularSeasonEndWeek: number;
  scoringPreset: string;
  settings: {
    scoringRules?: unknown;
    rosterSlots: RosterSlotConfig[];
    irEligibleStatuses?: string[];
  };
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  taxiEnabled: boolean;
  taxiSlots: number;
};

type ExistingMatchupRow = {
  id: string;
  status: "scheduled" | "in_progress" | "final";
  publicId: string | null;
  week: number;
  leagueSeasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  homePts: number | null;
  awayPts: number | null;
  finalizedAt: Date | null;
};

type PersistOutcome = "finalized" | "in_progress" | "unchanged" | "corrected";

function classifyPersistOutcome(
  existing: ExistingMatchupRow | undefined,
  input: {
    homePts: number | null;
    awayPts: number | null;
    status: "scheduled" | "in_progress" | "final";
  },
): {
  outcome: PersistOutcome;
  alreadyFinal: boolean;
  ptsChanged: boolean;
} {
  const alreadyFinal = existing?.status === "final";
  const ptsChanged =
    !!existing &&
    alreadyFinal &&
    input.status === "final" &&
    input.homePts != null &&
    input.awayPts != null &&
    existing.homePts != null &&
    existing.awayPts != null &&
    (Math.abs(existing.homePts - input.homePts) > 0.05 ||
      Math.abs(existing.awayPts - input.awayPts) > 0.05);

  if (existing && ptsChanged) {
    return { outcome: "corrected", alreadyFinal, ptsChanged };
  }
  if (existing && existing.status !== "final" && input.status === "final") {
    return { outcome: "finalized", alreadyFinal, ptsChanged };
  }
  if (alreadyFinal) {
    return { outcome: "unchanged", alreadyFinal, ptsChanged };
  }
  if (input.status === "final") {
    return { outcome: "finalized", alreadyFinal, ptsChanged };
  }
  if (input.status === "in_progress") {
    return { outcome: "in_progress", alreadyFinal, ptsChanged };
  }
  return { outcome: "unchanged", alreadyFinal, ptsChanged };
}

export async function persistEnrichedMatchups(
  games: Array<{
    id: string;
    resultFinal: boolean;
    home: {
      actualPts: number | null;
      starters?: Array<{ playerId: string; slotPositionId?: string | null }>;
    };
    away: {
      actualPts: number | null;
      starters?: Array<{ playerId: string; slotPositionId?: string | null }>;
    };
    leagueSeasonId?: string;
    homeTeamId?: string;
    awayTeamId?: string;
    week: number;
  }>,
): Promise<{ finalized: number; inProgress: number; corrected: number }> {
  if (games.length === 0) {
    return { finalized: 0, inProgress: 0, corrected: 0 };
  }

  const gameIds = games.map((g) => g.id);
  const existingRows = await db
    .select({
      id: matchups.id,
      status: matchups.status,
      publicId: matchups.publicId,
      week: matchups.week,
      leagueSeasonId: matchups.leagueSeasonId,
      homeTeamId: matchups.homeTeamId,
      awayTeamId: matchups.awayTeamId,
      homePts: matchups.homePts,
      awayPts: matchups.awayPts,
      finalizedAt: matchups.finalizedAt,
    })
    .from(matchups)
    .where(inArray(matchups.id, gameIds));
  const existingById = new Map(existingRows.map((row) => [row.id, row]));

  const teamIds = new Set<string>();
  const seasonIds = new Set<string>();
  for (const row of existingRows) {
    teamIds.add(row.homeTeamId);
    teamIds.add(row.awayTeamId);
    seasonIds.add(row.leagueSeasonId);
  }

  const [teamNameRows, leaguePublicRows] = await Promise.all([
    teamIds.size
      ? db
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(inArray(teams.id, [...teamIds]))
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    seasonIds.size
      ? db
          .select({
            seasonId: leagueSeasons.id,
            publicId: leagues.publicId,
          })
          .from(leagueSeasons)
          .innerJoin(leagues, eq(leagueSeasons.leagueId, leagues.id))
          .where(inArray(leagueSeasons.id, [...seasonIds]))
      : Promise.resolve(
          [] as Array<{ seasonId: string; publicId: string }>,
        ),
  ]);
  const teamNameById = new Map(teamNameRows.map((t) => [t.id, t.name]));
  const leaguePublicBySeasonId = new Map(
    leaguePublicRows.map((r) => [r.seasonId, r.publicId]),
  );

  const now = new Date();
  const planned = games.map((game) => {
    const homePts = game.home.actualPts;
    const awayPts = game.away.actualPts;
    let status: "scheduled" | "in_progress" | "final" = "scheduled";
    if (game.resultFinal && homePts != null && awayPts != null) {
      status = "final";
    } else if (homePts != null || awayPts != null) {
      status = "in_progress";
    }
    const existing = existingById.get(game.id);
    const { outcome, alreadyFinal } = classifyPersistOutcome(existing, {
      homePts,
      awayPts,
      status,
    });
    return { game, homePts, awayPts, status, existing, outcome, alreadyFinal };
  });

  await Promise.all(
    planned.map(({ game, homePts, awayPts, status, existing, alreadyFinal }) =>
      db
        .update(matchups)
        .set({
          homePts,
          awayPts,
          status,
          finalizedAt:
            status === "final"
              ? alreadyFinal
                ? (existing?.finalizedAt ?? now)
                : now
              : null,
          updatedAt: now,
        })
        .where(eq(matchups.id, game.id)),
    ),
  );

  let finalized = 0;
  let inProgress = 0;
  let corrected = 0;

  const alertJobs: Promise<unknown>[] = [];
  const lineupWrites: Promise<void>[] = [];
  const { upsertTeamWeekLineup } = await import("./lineup-snapshots");

  for (const {
    game,
    homePts,
    awayPts,
    existing,
    outcome,
  } of planned) {
    if (outcome === "corrected") corrected += 1;
    else if (outcome === "finalized") finalized += 1;
    else if (outcome === "in_progress") inProgress += 1;

    if (
      outcome === "finalized" &&
      game.leagueSeasonId &&
      game.homeTeamId &&
      game.awayTeamId
    ) {
      if (game.home.starters?.length) {
        lineupWrites.push(
          upsertTeamWeekLineup({
            leagueSeasonId: game.leagueSeasonId,
            teamId: game.homeTeamId,
            week: game.week,
            starters: game.home.starters,
          }),
        );
      }
      if (game.away.starters?.length) {
        lineupWrites.push(
          upsertTeamWeekLineup({
            leagueSeasonId: game.leagueSeasonId,
            teamId: game.awayTeamId,
            week: game.week,
            starters: game.away.starters,
          }),
        );
      }
    }

    if (
      !existing?.publicId ||
      homePts == null ||
      awayPts == null ||
      (outcome !== "corrected" && outcome !== "finalized")
    ) {
      continue;
    }

    const leaguePublicId = leaguePublicBySeasonId.get(existing.leagueSeasonId);
    if (!leaguePublicId) continue;

    const homeTeamName = teamNameById.get(existing.homeTeamId) ?? "Home";
    const awayTeamName = teamNameById.get(existing.awayTeamId) ?? "Away";

    if (
      outcome === "corrected" &&
      existing.homePts != null &&
      existing.awayPts != null
    ) {
      alertJobs.push(
        import("@/lib/alerts/matchups").then(({ announceScoreCorrected }) =>
          announceScoreCorrected({
            matchupId: game.id,
            matchupPublicId: existing.publicId!,
            leagueSeasonId: existing.leagueSeasonId,
            leaguePublicId,
            week: existing.week,
            homeTeamId: existing.homeTeamId,
            awayTeamId: existing.awayTeamId,
            homeTeamName,
            awayTeamName,
            homePtsBefore: existing.homePts!,
            awayPtsBefore: existing.awayPts!,
            homePtsAfter: homePts,
            awayPtsAfter: awayPts,
          }).catch(() => null),
        ),
      );
    } else if (outcome === "finalized" && existing.status !== "final") {
      alertJobs.push(
        import("@/lib/alerts/matchups").then(({ announceMatchupFinalized }) =>
          announceMatchupFinalized({
            matchupId: game.id,
            matchupPublicId: existing.publicId!,
            leagueSeasonId: existing.leagueSeasonId,
            leaguePublicId,
            week: existing.week,
            homeTeamId: existing.homeTeamId,
            awayTeamId: existing.awayTeamId,
            homePts,
            awayPts,
            homeTeamName,
            awayTeamName,
          }).catch(() => null),
        ),
      );
    }
  }

  await Promise.all([...lineupWrites, ...alertJobs]);

  return { finalized, inProgress, corrected };
}

/**
 * Recompute one season-week from live player_scores and persist status/pts.
 */
export async function finalizeSeasonWeekMatchups(input: {
  season: SeasonFinalizeRow;
  week: number;
  currentWeek: number;
  scoreboardGames: ScheduleGame[];
  allowOfficialCorrections?: boolean;
}): Promise<{ finalized: number; inProgress: number; corrected: number }> {
  const rows = await getWeekMatchups(input.season.id, input.week);
  if (rows.length === 0) {
    return { finalized: 0, inProgress: 0, corrected: 0 };
  }

  // Check if all matchups are already final
  const allFinal = rows.every((m) => m.status === "final");
  
  // Early return: all final + corrections off
  if (allFinal && !input.allowOfficialCorrections) {
    return { finalized: 0, inProgress: 0, corrected: 0 };
  }

  const scoringRules = resolveScoringRuleDefinitions(
    input.season.scoringPreset as ScoringPreset,
    input.season.settings.scoringRules as never,
  );

  // Always re-read player_scores for finalize/correction (module cache can be warm).
  const { clearScoreRowsCache } = await import("@/lib/queries/players");
  clearScoreRowsCache();

  // Correction path: load frozen lineups
  let frozenLineupsByTeam: Map<string, Array<{ playerId: string; slotPositionId?: string | null }>> | undefined;
  if (allFinal && input.allowOfficialCorrections) {
    const { loadTeamWeekLineups } = await import("./lineup-snapshots");
    const teamIds = Array.from(
      new Set(rows.flatMap((m) => [m.homeTeamId, m.awayTeamId]))
    );
    const snapshots = await loadTeamWeekLineups({
      leagueSeasonId: input.season.id,
      teamIds,
      week: input.week,
    });

    // If no snapshots exist for this week, skip correction entirely
    if (snapshots.size === 0) {
      console.warn(
        `No snapshots found for season ${input.season.id} week ${input.week}; skipping correction to avoid rewriting history from live roster`
      );
      return { finalized: 0, inProgress: 0, corrected: 0 };
    }

    // Map teamId → array of { playerId, slotPositionId }
    frozenLineupsByTeam = new Map();
    for (const [teamId, lineupRows] of snapshots.entries()) {
      frozenLineupsByTeam.set(
        teamId,
        lineupRows.map((r) => ({
          playerId: r.playerId,
          slotPositionId: r.slotPositionId ?? undefined,
        }))
      );
    }
  }

  const includeStarters = !allFinal; // Capture starters only on first finalize

  const board = await enrichWeekMatchupBoard({
    leagueSeasonId: input.season.id,
    matchups: rows,
    week: input.week,
    currentWeek: input.currentWeek,
    seasonYear: String(input.season.seasonYear),
    scoringRules,
    rosterSlots: input.season.settings.rosterSlots,
    benchSlots: input.season.benchSlots,
    irEnabled: input.season.irEnabled,
    irSlots: input.season.irSlots,
    irEligibleStatuses: input.season.settings.irEligibleStatuses,
    taxiEnabled: input.season.taxiEnabled,
    taxiSlots: input.season.taxiSlots,
    scoreboardGames: input.scoreboardGames,
    frozenLineupsByTeam,
    includeStarters,
  });

  return persistEnrichedMatchups(board);
}

/**
 * After a score sync, finalize matchups for all seasons in that year
 * through the synced week.
 *
 * Fully-final weeks are skipped unless the season enables
 * `applyOfficialStatChanges` (recompute pts from corrected official stats).
 */
export async function finalizeDueMatchupsAfterScoreSync(input: {
  seasonYear: string;
  week: number;
}): Promise<FinalizeMatchupsResult> {
  const year = Number(input.seasonYear);
  if (!Number.isFinite(year) || input.week < 1) {
    return {
      seasonsChecked: 0,
      weeksChecked: 0,
      finalized: 0,
      inProgress: 0,
      corrected: 0,
      playoffAdvanceErrors: [],
    };
  }

  const seasons = await db
    .select({
      id: leagueSeasons.id,
      seasonYear: leagueSeasons.seasonYear,
      regularSeasonEndWeek: leagueSeasons.regularSeasonEndWeek,
      championshipWeek: leagueSeasons.championshipWeek,
      playoffTeamCount: leagueSeasons.playoffTeamCount,
      scoringPreset: leagueSeasons.scoringPreset,
      settings: leagueSeasons.settings,
      benchSlots: leagueSeasons.benchSlots,
      irEnabled: leagueSeasons.irEnabled,
      irSlots: leagueSeasons.irSlots,
      taxiEnabled: leagueSeasons.taxiEnabled,
      taxiSlots: leagueSeasons.taxiSlots,
    })
    .from(leagueSeasons)
    .where(eq(leagueSeasons.seasonYear, year));

  let weeksChecked = 0;
  let finalized = 0;
  let inProgress = 0;
  let corrected = 0;
  const playoffAdvanceErrors: Array<{ leagueSeasonId: string; error: string }> =
    [];

  const scoreboardCache = new Map<number, ScheduleGame[]>();

  async function gamesForWeek(week: number): Promise<ScheduleGame[]> {
    const cached = scoreboardCache.get(week);
    if (cached) return cached;
    const board = await getNflScoreboard({
      season: year,
      week,
    }).catch(() => null);
    const games = board?.games ?? [];
    scoreboardCache.set(week, games);
    return games;
  }

  for (const season of seasons) {
    const tiebreakers = resolveTiebreakerSettings(
      (season.settings as LeagueSeasonSettings | null)?.tiebreakers,
    );
    const allowOfficialCorrections = tiebreakers.applyOfficialStatChanges;

    const playoffs = resolvePlayoffSettings(
      (season.settings as LeagueSeasonSettings | null)?.playoffs,
    );
    const playoffEndWeek = playoffs.enabled
      ? season.championshipWeek
      : undefined;

    const maxWeek = finalizeMaxWeek({
      inputWeek: input.week,
      regularSeasonEndWeek: season.regularSeasonEndWeek,
      playoffEndWeek,
    });

    const weekCounts = await db
      .select({
        week: matchups.week,
        pending: sql<number>`count(*) filter (where ${matchups.status} <> 'final')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(matchups)
      .where(
        and(
          eq(matchups.leagueSeasonId, season.id),
          lte(matchups.week, maxWeek),
        ),
      )
      .groupBy(matchups.week);
    const weekCountByWeek = new Map(
      weekCounts.map((row) => [row.week, row]),
    );

    for (let week = 1; week <= maxWeek; week++) {
      const counts = weekCountByWeek.get(week);
      const pending = counts?.pending ?? 0;
      const total = counts?.total ?? 0;

      if (pending === 0 && !allowOfficialCorrections) {
        if (total > 0) {
          continue;
        }
      }

      weeksChecked += 1;
      const scoreboardGames =
        week === maxWeek || allowOfficialCorrections
          ? await gamesForWeek(week)
          : [];
      const result = await finalizeSeasonWeekMatchups({
        season: season as SeasonFinalizeRow,
        week,
        currentWeek: input.week,
        scoreboardGames,
        allowOfficialCorrections,
      });
      finalized += result.finalized;
      inProgress += result.inProgress;
      corrected += result.corrected;
    }

    try {
      await ensurePlayoffMatchupsAdvanced({
        leagueSeasonId: season.id,
        currentNflWeek: input.week,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Playoff advance failed";
      console.error(
        `Failed to advance playoff matchups for season ${season.id}:`,
        error,
      );
      playoffAdvanceErrors.push({
        leagueSeasonId: season.id,
        error: message,
      });
    }
  }

  return {
    seasonsChecked: seasons.length,
    weeksChecked,
    finalized,
    inProgress,
    corrected,
    playoffAdvanceErrors,
  };
}

/** Load final matchups for standings. */