import "server-only";

import { and, asc, eq, gte } from "drizzle-orm";

import { leagueSeasons, matchups, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { allocateMatchupPublicIds } from "@/lib/leagues/ensure-public-ids";
import { getFinalMatchupsForSeason } from "@/lib/leagues/matchups/finalize";
import { resolvePlayoffSettings } from "@/lib/leagues/playoff-settings";
import {
  championshipLegs,
  duplicatePairingsForWeek,
  firstRoundPairings,
  nextRoundPairings,
  winnerOfFinalMatchup,
  type PlayoffSeedTeam,
} from "@/lib/leagues/playoffs/advance";
import { buildLeagueStandings } from "@/lib/leagues/standings-from-matchups";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";
import { getPlayoffWeekRange } from "@/lib/leagues/season-calendar";
import { resolveTiebreakerSettings } from "@/lib/leagues/tiebreakers";
import { loadTeamWeekGameTieMetrics } from "@/lib/leagues/tiebreakers/load-game-metrics";

/**
 * Ensure first-round playoff matchups exist once the regular season ends,
 * and insert the next playoff week when the prior week is fully final.
 */
export async function ensurePlayoffMatchupsAdvanced(input: {
  leagueSeasonId: string;
  currentNflWeek: number;
}): Promise<{ inserted: number }> {
  const [season] = await db
    .select({
      id: leagueSeasons.id,
      seasonYear: leagueSeasons.seasonYear,
      teamCount: leagueSeasons.teamCount,
      playoffTeamCount: leagueSeasons.playoffTeamCount,
      championshipWeek: leagueSeasons.championshipWeek,
      regularSeasonEndWeek: leagueSeasons.regularSeasonEndWeek,
      scoringPreset: leagueSeasons.scoringPreset,
      settings: leagueSeasons.settings,
    })
    .from(leagueSeasons)
    .where(eq(leagueSeasons.id, input.leagueSeasonId))
    .limit(1);

  if (!season) return { inserted: 0 };

  const playoffs = resolvePlayoffSettings(season.settings.playoffs);
  if (!playoffs.enabled) return { inserted: 0 };

  const tiebreakers = resolveTiebreakerSettings(season.settings.tiebreakers);

  const range = getPlayoffWeekRange(
    season.championshipWeek,
    season.playoffTeamCount,
    {
      enabled: true,
      twoWeekChampionship: playoffs.twoWeekChampionship,
    },
  );
  if (!range) return { inserted: 0 };

  if (input.currentNflWeek < season.regularSeasonEndWeek) {
    return { inserted: 0 };
  }

  const existingPlayoff = await db
    .select({
      id: matchups.id,
      week: matchups.week,
      homeTeamId: matchups.homeTeamId,
      awayTeamId: matchups.awayTeamId,
      homePts: matchups.homePts,
      awayPts: matchups.awayPts,
      status: matchups.status,
    })
    .from(matchups)
    .where(
      and(
        eq(matchups.leagueSeasonId, season.id),
        gte(matchups.week, range.startWeek),
      ),
    )
    .orderBy(asc(matchups.week), asc(matchups.id));

  let inserted = 0;
  let playoffSeeds: PlayoffSeedTeam[] = [];

  const firstWeekRows = existingPlayoff.filter(
    (row) => row.week === range.startWeek,
  );

  async function loadPlayoffSeeds() {
    const teamRows = await db
      .select({
        teamId: teams.id,
        teamName: teams.name,
        teamPublicId: teams.publicId,
        userId: teams.userId,
        draftSlot: teams.draftSlot,
        teamCreatedAt: teams.createdAt,
        waiverPriority: teams.waiverPriority,
        faabRemaining: teams.faabRemaining,
        logoUrl: teams.logoUrl,
      })
      .from(teams)
      .where(eq(teams.leagueSeasonId, season.id));

    const members: LeagueStandingsMember[] = teamRows.map((row) => ({
      ...row,
      displayName: null,
    }));

    const finals = await getFinalMatchupsForSeason(season.id);
    const standings = buildLeagueStandings(
      members,
      { teamCount: season.teamCount, faabBudget: null },
      finals.filter((m) => m.week <= season.regularSeasonEndWeek),
      tiebreakers,
    );

    return standings
      .filter((row): row is (typeof standings)[number] & { teamId: string } =>
        Boolean(row.teamId),
      )
      .slice(0, season.playoffTeamCount)
      .map((row, index) => ({
        seed: index + 1,
        teamId: row.teamId,
      }));
  }

  if (firstWeekRows.length === 0 && input.currentNflWeek >= range.startWeek) {
    playoffSeeds = await loadPlayoffSeeds();

    const pairings = firstRoundPairings({
      seeds: playoffSeeds,
      playoffTeamCount: season.playoffTeamCount,
      championshipWeek: season.championshipWeek,
      twoWeekChampionship: playoffs.twoWeekChampionship,
    });

    inserted += await insertPairings(season.id, pairings);
    for (const pairing of pairings) {
      existingPlayoff.push({
        id: "",
        week: pairing.week,
        homeTeamId: pairing.homeTeamId,
        awayTeamId: pairing.awayTeamId,
        homePts: null,
        awayPts: null,
        status: "scheduled",
      });
    }
  } else if (
    season.playoffTeamCount === 6 ||
    playoffs.reSeedAfterEachRound
  ) {
    playoffSeeds = await loadPlayoffSeeds();
  }

  const weeks = Array.from(
    { length: range.endWeek - range.startWeek + 1 },
    (_, i) => range.startWeek + i,
  );

  const seedByTeamId = new Map(
    playoffSeeds.map((seed) => [seed.teamId, seed.seed]),
  );

  const legs = championshipLegs({
    endWeek: range.endWeek,
    twoWeekChampionship: playoffs.twoWeekChampionship,
  });

  // Backfill championship Game 2 if Game 1 exists without a matching leg.
  if (legs) {
    const leg1Rows = existingPlayoff.filter((row) => row.week === legs.leg1Week);
    const leg2Rows = existingPlayoff.filter((row) => row.week === legs.leg2Week);
    if (leg1Rows.length > 0 && leg2Rows.length === 0) {
      const copies = duplicatePairingsForWeek(leg1Rows, legs.leg2Week);
      inserted += await insertPairings(season.id, copies);
      for (const pairing of copies) {
        existingPlayoff.push({
          id: "",
          week: pairing.week,
          homeTeamId: pairing.homeTeamId,
          awayTeamId: pairing.awayTeamId,
          homePts: null,
          awayPts: null,
          status: "scheduled",
        });
      }
    }
  }

  for (let i = 0; i < weeks.length - 1; i++) {
    const week = weeks[i]!;
    const nextWeek = weeks[i + 1]!;
    const weekRows = existingPlayoff.filter((row) => row.week === week);
    const nextRows = existingPlayoff.filter((row) => row.week === nextWeek);
    if (weekRows.length === 0 || nextRows.length > 0) continue;

    // Championship Game 2 is a rematch, not an advance from Game 1 winners.
    if (legs && week === legs.leg1Week && nextWeek === legs.leg2Week) {
      continue;
    }

    if (!weekRows.every((row) => row.status === "final")) continue;

    const teamIds = [
      ...new Set(
        weekRows.flatMap((row) => [row.homeTeamId, row.awayTeamId]),
      ),
    ];

    // Load frozen lineups for this week when present
    const { loadTeamWeekLineups } = await import("@/lib/leagues/matchups/lineup-snapshots");
    const frozenSnapshots = await loadTeamWeekLineups({
      leagueSeasonId: season.id,
      teamIds,
      week,
    });

    // Convert snapshots to the format expected by loadTeamWeekGameTieMetrics
    const frozenLineups = frozenSnapshots.size > 0
      ? new Map(
          [...frozenSnapshots.entries()].map(([teamId, snapshots]) => [
            teamId,
            snapshots.map((s) => ({
              playerId: s.playerId,
              slotPositionId: s.slotPositionId,
            })),
          ])
        )
      : undefined;

    const metricsByTeam = await loadTeamWeekGameTieMetrics({
      teamIds,
      seasonYear: season.seasonYear,
      week,
      scoringPreset: season.scoringPreset,
      scoringRules: season.settings.scoringRules,
      frozenLineups,
    });

    // Sort matchups deterministically by best (lowest) seed in each pairing,
    // then by home seed, to ensure consistent winner ordering for bracket advancement.
    const sortedWeekRows = weekRows.toSorted((a, b) => {
      const aSeeds = [
        seedByTeamId.get(a.homeTeamId) ?? Number.MAX_SAFE_INTEGER,
        seedByTeamId.get(a.awayTeamId) ?? Number.MAX_SAFE_INTEGER,
      ];
      const bSeeds = [
        seedByTeamId.get(b.homeTeamId) ?? Number.MAX_SAFE_INTEGER,
        seedByTeamId.get(b.awayTeamId) ?? Number.MAX_SAFE_INTEGER,
      ];
      const aMin = Math.min(...aSeeds);
      const bMin = Math.min(...bSeeds);
      if (aMin !== bMin) return aMin - bMin;
      return aSeeds[0]! - bSeeds[0]!;
    });

    const winners = sortedWeekRows
      .map((row) =>
        winnerOfFinalMatchup({
          homeTeamId: row.homeTeamId,
          awayTeamId: row.awayTeamId,
          homePts: row.homePts,
          awayPts: row.awayPts,
          status: row.status,
          gameTiebreakers: tiebreakers.gameTiebreakers,
          homeMetrics: metricsByTeam.get(row.homeTeamId) ?? null,
          awayMetrics: metricsByTeam.get(row.awayTeamId) ?? null,
        }),
      )
      .filter((id): id is string => id != null);

    if (winners.length === 0) continue;
    if (winners.length !== weekRows.length) continue;

    const byeTeamIds =
      season.playoffTeamCount === 6 && week === range.startWeek
        ? playoffSeeds.slice(0, 2).map((seed) => seed.teamId)
        : [];

    const pairings = nextRoundPairings({
      nextWeek,
      winnersInBracketOrder: winners,
      byeTeamIds,
      reSeedAfterEachRound: playoffs.reSeedAfterEachRound,
      seedByTeamId,
    });

    inserted += await insertPairings(season.id, pairings);
    for (const pairing of pairings) {
      existingPlayoff.push({
        id: "",
        week: pairing.week,
        homeTeamId: pairing.homeTeamId,
        awayTeamId: pairing.awayTeamId,
        homePts: null,
        awayPts: null,
        status: "scheduled",
      });
    }

    // When creating championship Game 1 under two-week finals, also schedule Game 2.
    if (
      legs &&
      nextWeek === legs.leg1Week &&
      !existingPlayoff.some((row) => row.week === legs.leg2Week)
    ) {
      const copies = duplicatePairingsForWeek(pairings, legs.leg2Week);
      inserted += await insertPairings(season.id, copies);
      for (const pairing of copies) {
        existingPlayoff.push({
          id: "",
          week: pairing.week,
          homeTeamId: pairing.homeTeamId,
          awayTeamId: pairing.awayTeamId,
          homePts: null,
          awayPts: null,
          status: "scheduled",
        });
      }
    }
  }

  return { inserted };
}

async function insertPairings(
  leagueSeasonId: string,
  pairings: Array<{ week: number; homeTeamId: string; awayTeamId: string }>,
) {
  if (pairings.length === 0) return 0;
  const publicIds = await allocateMatchupPublicIds(
    leagueSeasonId,
    pairings.length,
  );
  await db
    .insert(matchups)
    .values(
      pairings.map((row, index) => ({
        leagueSeasonId,
        publicId: publicIds[index]!,
        week: row.week,
        homeTeamId: row.homeTeamId,
        awayTeamId: row.awayTeamId,
      })),
    )
    .onConflictDoNothing();
  return pairings.length;
}
