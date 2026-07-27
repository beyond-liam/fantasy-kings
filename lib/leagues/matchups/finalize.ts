import { and, eq, inArray, sql } from "drizzle-orm";

import { leagueSeasons, matchups } from "@/db/schema";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import type { ScheduleGame } from "@/lib/espn/scoreboard";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring/rules";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { ensurePlayoffMatchupsAdvanced } from "@/lib/leagues/playoffs/ensure-matchups";
import { resolveTiebreakerSettings } from "@/lib/leagues/tiebreakers";
import { getWeekMatchups } from "@/lib/queries/matchups";
import { enrichWeekMatchupBoard } from "@/lib/queries/week-matchup-board";
import { finalizeMaxWeek } from "./finalize-gates";

export type FinalizeMatchupsResult = {
  seasonsChecked: number;
  weeksChecked: number;
  finalized: number;
  inProgress: number;
  corrected: number;
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

async function persistMatchupStatus(input: {
  matchupId: string;
  homePts: number | null;
  awayPts: number | null;
  status: "scheduled" | "in_progress" | "final";
}): Promise<"finalized" | "in_progress" | "unchanged" | "corrected"> {
  const [existing] = await db
    .select({
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
    .where(eq(matchups.id, input.matchupId))
    .limit(1);

  const now = new Date();
  const alreadyFinal = existing?.status === "final";
  const ptsChanged =
    alreadyFinal &&
    input.status === "final" &&
    input.homePts != null &&
    input.awayPts != null &&
    existing.homePts != null &&
    existing.awayPts != null &&
    (Math.abs(existing.homePts - input.homePts) > 0.05 ||
      Math.abs(existing.awayPts - input.awayPts) > 0.05);

  await db
    .update(matchups)
    .set({
      homePts: input.homePts,
      awayPts: input.awayPts,
      status: input.status,
      // Keep original finalize time when correcting an already-final matchup.
      finalizedAt:
        input.status === "final"
          ? (alreadyFinal ? (existing.finalizedAt ?? now) : now)
          : null,
      updatedAt: now,
    })
    .where(eq(matchups.id, input.matchupId));

  if (
    existing &&
    ptsChanged &&
    input.homePts != null &&
    input.awayPts != null &&
    existing.homePts != null &&
    existing.awayPts != null &&
    existing.publicId
  ) {
    const { announceScoreCorrected } = await import("@/lib/alerts/matchups");
    const { teams, leagues, leagueSeasons } = await import("@/db/schema");
    const [home] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, existing.homeTeamId))
      .limit(1);
    const [away] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, existing.awayTeamId))
      .limit(1);
    const [league] = await db
      .select({ publicId: leagues.publicId })
      .from(leagueSeasons)
      .innerJoin(leagues, eq(leagueSeasons.leagueId, leagues.id))
      .where(eq(leagueSeasons.id, existing.leagueSeasonId))
      .limit(1);

    if (league?.publicId) {
      await announceScoreCorrected({
        matchupId: input.matchupId,
        matchupPublicId: existing.publicId,
        leagueSeasonId: existing.leagueSeasonId,
        leaguePublicId: league.publicId,
        week: existing.week,
        homeTeamId: existing.homeTeamId,
        awayTeamId: existing.awayTeamId,
        homeTeamName: home?.name ?? "Home",
        awayTeamName: away?.name ?? "Away",
        homePtsBefore: existing.homePts,
        awayPtsBefore: existing.awayPts,
        homePtsAfter: input.homePts,
        awayPtsAfter: input.awayPts,
      }).catch(() => null);
    }
    return "corrected";
  }

  if (
    existing &&
    existing.status !== "final" &&
    input.status === "final" &&
    input.homePts != null &&
    input.awayPts != null &&
    existing.publicId
  ) {
    const { announceMatchupFinalized } = await import("@/lib/alerts/matchups");
    const { teams, leagues, leagueSeasons } = await import("@/db/schema");
    const [home] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, existing.homeTeamId))
      .limit(1);
    const [away] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, existing.awayTeamId))
      .limit(1);
    const [league] = await db
      .select({ publicId: leagues.publicId })
      .from(leagueSeasons)
      .innerJoin(leagues, eq(leagueSeasons.leagueId, leagues.id))
      .where(eq(leagueSeasons.id, existing.leagueSeasonId))
      .limit(1);

    if (league?.publicId) {
      await announceMatchupFinalized({
        matchupId: input.matchupId,
        matchupPublicId: existing.publicId,
        leagueSeasonId: existing.leagueSeasonId,
        leaguePublicId: league.publicId,
        week: existing.week,
        homeTeamId: existing.homeTeamId,
        awayTeamId: existing.awayTeamId,
        homePts: input.homePts,
        awayPts: input.awayPts,
        homeTeamName: home?.name ?? "Home",
        awayTeamName: away?.name ?? "Away",
      }).catch(() => null);
    }
    return "finalized";
  }

  if (input.status === "final") return "finalized";
  if (input.status === "in_progress") return "in_progress";
  return "unchanged";
}

export async function persistEnrichedMatchups(
  games: Array<{
    id: string;
    resultFinal: boolean;
    home: { actualPts: number | null };
    away: { actualPts: number | null };
  }>,
): Promise<{ finalized: number; inProgress: number; corrected: number }> {
  let finalized = 0;
  let inProgress = 0;
  let corrected = 0;

  for (const game of games) {
    const homePts = game.home.actualPts;
    const awayPts = game.away.actualPts;

    let status: "scheduled" | "in_progress" | "final" = "scheduled";
    if (game.resultFinal && homePts != null && awayPts != null) {
      status = "final";
    } else if (homePts != null || awayPts != null) {
      status = "in_progress";
    }

    const outcome = await persistMatchupStatus({
      matchupId: game.id,
      homePts,
      awayPts,
      status,
    });
    if (outcome === "corrected") corrected += 1;
    else if (outcome === "finalized") finalized += 1;
    else if (outcome === "in_progress") inProgress += 1;
  }

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
}): Promise<{ finalized: number; inProgress: number; corrected: number }> {
  const rows = await getWeekMatchups(input.season.id, input.week);
  if (rows.length === 0) {
    return { finalized: 0, inProgress: 0, corrected: 0 };
  }

  const scoringRules = resolveScoringRuleDefinitions(
    input.season.scoringPreset as ScoringPreset,
    input.season.settings.scoringRules as never,
  );

  const board = await enrichWeekMatchupBoard({
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
    };
  }

  const seasons = await db
    .select({
      id: leagueSeasons.id,
      seasonYear: leagueSeasons.seasonYear,
      regularSeasonEndWeek: leagueSeasons.regularSeasonEndWeek,
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

    const maxWeek = finalizeMaxWeek({
      inputWeek: input.week,
      regularSeasonEndWeek: season.regularSeasonEndWeek,
    });
    for (let week = 1; week <= maxWeek; week++) {
      // Skip weeks that are already fully final — unless corrections are on.
      const [{ pending }] = await db
        .select({
          pending: sql<number>`count(*)::int`,
        })
        .from(matchups)
        .where(
          and(
            eq(matchups.leagueSeasonId, season.id),
            eq(matchups.week, week),
            sql`${matchups.status} <> 'final'`,
          ),
        );

      if (pending === 0 && !allowOfficialCorrections) {
        const [{ total }] = await db
          .select({ total: sql<number>`count(*)::int` })
          .from(matchups)
          .where(
            and(
              eq(matchups.leagueSeasonId, season.id),
              eq(matchups.week, week),
            ),
          );
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
      });
      finalized += result.finalized;
      inProgress += result.inProgress;
      corrected += result.corrected;
    }

    // Plan 004: surface advancement errors (swallowed here).
    await ensurePlayoffMatchupsAdvanced({
      leagueSeasonId: season.id,
      currentNflWeek: input.week,
    }).catch(() => null);
  }

  return {
    seasonsChecked: seasons.length,
    weeksChecked,
    finalized,
    inProgress,
    corrected,
  };
}

/** Load final matchups for standings. */
export async function getFinalMatchupsForSeason(leagueSeasonId: string) {
  return db
    .select({
      id: matchups.id,
      week: matchups.week,
      homeTeamId: matchups.homeTeamId,
      awayTeamId: matchups.awayTeamId,
      homePts: matchups.homePts,
      awayPts: matchups.awayPts,
    })
    .from(matchups)
    .where(
      and(
        eq(matchups.leagueSeasonId, leagueSeasonId),
        eq(matchups.status, "final"),
      ),
    )
    .orderBy(matchups.week);
}

/** Batch finals for many seasons (leagues list). */
export async function getFinalMatchupsForSeasons(
  leagueSeasonIds: string[],
): Promise<Map<string, Awaited<ReturnType<typeof getFinalMatchupsForSeason>>>> {
  const map = new Map<
    string,
    Awaited<ReturnType<typeof getFinalMatchupsForSeason>>
  >();
  if (leagueSeasonIds.length === 0) {
    return map;
  }

  for (const id of leagueSeasonIds) {
    map.set(id, []);
  }

  const rows = await db
    .select({
      leagueSeasonId: matchups.leagueSeasonId,
      id: matchups.id,
      week: matchups.week,
      homeTeamId: matchups.homeTeamId,
      awayTeamId: matchups.awayTeamId,
      homePts: matchups.homePts,
      awayPts: matchups.awayPts,
    })
    .from(matchups)
    .where(
      and(
        inArray(matchups.leagueSeasonId, leagueSeasonIds),
        eq(matchups.status, "final"),
      ),
    )
    .orderBy(matchups.week);

  for (const row of rows) {
    const list = map.get(row.leagueSeasonId) ?? [];
    list.push({
      id: row.id,
      week: row.week,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      homePts: row.homePts,
      awayPts: row.awayPts,
    });
    map.set(row.leagueSeasonId, list);
  }

  return map;
}

/** Records map for matchup board enrichment. */
export function recordsFromFinalMatchups(
  finals: Array<{
    homeTeamId: string;
    awayTeamId: string;
    homePts: number | null;
    awayPts: number | null;
  }>,
): Map<string, { wins: number; losses: number; ties: number }> {
  const map = new Map<string, { wins: number; losses: number; ties: number }>();

  const bump = (
    teamId: string,
    field: "wins" | "losses" | "ties",
  ) => {
    const row = map.get(teamId) ?? { wins: 0, losses: 0, ties: 0 };
    row[field] += 1;
    map.set(teamId, row);
  };

  for (const matchup of finals) {
    if (matchup.homePts == null || matchup.awayPts == null) continue;
    const diff = matchup.homePts - matchup.awayPts;
    if (Math.abs(diff) <= 0.05) {
      bump(matchup.homeTeamId, "ties");
      bump(matchup.awayTeamId, "ties");
    } else if (diff > 0) {
      bump(matchup.homeTeamId, "wins");
      bump(matchup.awayTeamId, "losses");
    } else {
      bump(matchup.awayTeamId, "wins");
      bump(matchup.homeTeamId, "losses");
    }
  }

  return map;
}
