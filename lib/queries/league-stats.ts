import { and, eq, inArray } from "drizzle-orm";
import { cache } from "react";

import { playerExternalIds, players, rosterPlayers, teams } from "@/db/schema";
import { profiles } from "@/db/schema/users";
import { db } from "@/lib/db";
import { computeOptimumLineup } from "@/lib/leagues/game-centre/optimum";
import {
  buildLeaguePositionStatsRows,
  getLeaderPositionColumns,
  type LeaguePositionStatsRow,
} from "@/lib/leagues/league-position-stats";
import { buildFilledRosterSections } from "@/lib/leagues/roster-fill";
import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring/rules";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";
import { getLeagueBySlug, getLeagueMembership, getLeagueSeason } from "@/lib/queries/leagues";
import { getRankedPlayers } from "@/lib/queries/players";
import { getNflState } from "@/lib/sleeper/api";

export type LeaguePositionStatsData = {
  leagueSlug: string;
  seasonYear: number;
  week: number;
  /** True only when season is active and weekly actual scores exist. */
  scoresAvailable: boolean;
  positionColumns: string[];
  rows: LeaguePositionStatsRow[];
  myTeamPublicId: string | null;
};

function teamIdentityRows(
  teamRows: Array<{
    teamId: string;
    teamName: string;
    teamPublicId: string | null;
    userId: string | null;
    displayName: string | null;
    logoUrl: string | null;
  }>,
) {
  return teamRows.map((team) => {
    const claimed = Boolean(team.userId);
    return {
      teamId: team.teamId,
      teamPublicId: team.teamPublicId,
      teamName: team.teamName,
      ownerName: claimed
        ? (team.displayName?.trim() || "Manager")
        : "Unclaimed",
      logoUrl: team.logoUrl,
      claimed,
      starters: [] as Array<{ slotPositionId: string; points: number }>,
      optimumPointsFor: null as number | null,
    };
  });
}

export const getLeaguePositionStats = cache(
  async (
    slug: string,
    userId: string,
  ): Promise<LeaguePositionStatsData | null> => {
    const league = await getLeagueBySlug(slug);
    if (!league) {
      return null;
    }

    const membership = await getLeagueMembership(league.id, userId);
    if (!membership) {
      return null;
    }

    const season = await getLeagueSeason(league.id);
    if (!season) {
      return null;
    }

    const positionColumns = getLeaderPositionColumns(
      season.settings.rosterSlots,
    );

    const teamRows = await db
      .select({
        teamId: teams.id,
        teamName: teams.name,
        teamPublicId: teams.publicId,
        userId: teams.userId,
        displayName: profiles.displayName,
        logoUrl: teams.logoUrl,
      })
      .from(teams)
      .leftJoin(profiles, eq(teams.userId, profiles.id))
      .where(eq(teams.leagueSeasonId, season.id));

    const myTeamPublicId =
      teamRows.find((team) => team.userId === userId)?.teamPublicId ?? null;

    const nflState = await getNflState().catch(() => ({
      season: String(season.seasonYear),
      week: 1,
    }));
    const week = Math.max(1, Number(nflState.week) || 1);

    if (teamRows.length === 0 || positionColumns.length === 0) {
      return {
        leagueSlug: league.publicId,
        seasonYear: season.seasonYear,
        week,
        scoresAvailable: false,
        positionColumns,
        rows: [],
        myTeamPublicId,
      };
    }

    const identityInputs = teamIdentityRows(teamRows);

    // Stats never use projections — only real scored points after the season starts.
    if (season.status !== "active") {
      return {
        leagueSlug: league.publicId,
        seasonYear: season.seasonYear,
        week,
        scoresAvailable: false,
        positionColumns,
        rows: buildLeaguePositionStatsRows(identityInputs, positionColumns, {
          scoresAvailable: false,
        }),
        myTeamPublicId,
      };
    }

    const teamIds = teamRows.map((team) => team.teamId);

    const rosterRows = await db
      .select({
        teamId: rosterPlayers.teamId,
        id: players.id,
        fullName: players.fullName,
        nflTeam: players.nflTeam,
        primaryPositionId: players.primaryPositionId,
        byeWeek: players.byeWeek,
        injuryStatus: players.injuryStatus,
        sleeperId: playerExternalIds.externalId,
        slotPositionId: rosterPlayers.slotPositionId,
      })
      .from(rosterPlayers)
      .innerJoin(players, eq(rosterPlayers.playerId, players.id))
      .leftJoin(
        playerExternalIds,
        and(
          eq(playerExternalIds.playerId, players.id),
          eq(playerExternalIds.provider, "sleeper"),
        ),
      )
      .where(
        and(
          inArray(rosterPlayers.teamId, teamIds),
          eq(rosterPlayers.status, "rostered"),
        ),
      );

    const playerIds = [...new Set(rosterRows.map((row) => row.id))];
    const seasonYear = String(season.seasonYear);
    const scoringRules = resolveScoringRuleDefinitions(
      season.scoringPreset as ScoringPreset,
      season.settings.scoringRules,
    );

    const weekStats = playerIds.length
      ? await getRankedPlayers({
          season: seasonYear,
          week,
          kind: "stats",
          scoringRules,
          playerIds,
        }).catch(() => [])
      : [];

    const actualById = new Map<string, number | null>(
      weekStats.map((row) => [row.id, row.fantasyPts]),
    );
    const scoresAvailable = weekStats.some((row) => row.fantasyPts != null);

    if (!scoresAvailable) {
      return {
        leagueSlug: league.publicId,
        seasonYear: season.seasonYear,
        week,
        scoresAvailable: false,
        positionColumns,
        rows: buildLeaguePositionStatsRows(identityInputs, positionColumns, {
          scoresAvailable: false,
        }),
        myTeamPublicId,
      };
    }

    const playersByTeam = new Map<string, typeof rosterRows>();
    for (const row of rosterRows) {
      const list = playersByTeam.get(row.teamId) ?? [];
      list.push(row);
      playersByTeam.set(row.teamId, list);
    }

    const fillInput = {
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
      irEnabled: season.irEnabled,
      irSlots: season.irSlots,
      taxiEnabled: season.taxiEnabled,
      taxiSlots: season.taxiSlots,
      irEligibleStatuses: season.settings.irEligibleStatuses,
    };

    const teamInputs = teamRows.map((team) => {
      const roster = (playersByTeam.get(team.teamId) ?? []).map((player) => ({
        id: player.id,
        fullName: player.fullName,
        nflTeam: player.nflTeam,
        primaryPositionId: player.primaryPositionId,
        byeWeek: player.byeWeek,
        injuryStatus: player.injuryStatus,
        sleeperId: player.sleeperId,
        slotPositionId: player.slotPositionId,
        actualPts: actualById.get(player.id) ?? 0,
      }));

      const sections = buildFilledRosterSections({
        ...fillInput,
        players: roster,
      });

      const starters = sections.lineup.map((slot) => ({
        slotPositionId: slot.slotPositionId,
        points: slot.player ? (actualById.get(slot.player.id) ?? 0) : 0,
      }));

      const optimum = computeOptimumLineup({
        lineup: sections.lineup,
        rosterPlayers: roster,
        projectedById: actualById,
        startedTeams: new Set(),
        irEligibleStatuses: season.settings.irEligibleStatuses,
      });

      const claimed = Boolean(team.userId);

      return {
        teamId: team.teamId,
        teamPublicId: team.teamPublicId,
        teamName: team.teamName,
        ownerName: claimed
          ? (team.displayName?.trim() || "Manager")
          : "Unclaimed",
        logoUrl: team.logoUrl,
        claimed,
        starters,
        optimumPointsFor: optimum.optimumProjectedTotal,
      };
    });

    return {
      leagueSlug: league.publicId,
      seasonYear: season.seasonYear,
      week,
      scoresAvailable: true,
      positionColumns,
      rows: buildLeaguePositionStatsRows(teamInputs, positionColumns, {
        scoresAvailable: true,
      }),
      myTeamPublicId,
    };
  },
);
