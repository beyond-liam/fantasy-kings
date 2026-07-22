import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";

import {
  draftPicks,
  drafts,
  leagueActivity,
  playerExternalIds,
  playerScores,
  players,
  teams,
  tradePlayers,
  trades,
  waiverClaims,
} from "@/db/schema";
import type { LeagueActivityMetadata } from "@/db/schema/league-activity";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isRosterTransactionsEnabled } from "@/lib/leagues/free-agency";
import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import { normalizePlayerStats } from "@/lib/leagues/scoring/normalize-stats";
import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring/rules";
import type {
  ScoringPreset,
  ScoringRuleDefinition,
} from "@/lib/leagues/scoring/types";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import { resolvePlayerAcquisitionKind } from "@/lib/leagues/waivers/resolve-kind";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
} from "@/lib/queries/leagues";
import {
  getLeaguePlayerOwnershipMap,
  resolvePlayerOwnership,
} from "@/lib/queries/roster";
import {
  getTeamWatchlistPlayerIds,
  getUserTeamForSeason,
} from "@/lib/queries/watchlist";
import {
  getStatColumns,
  type PositionFilter,
  type StatColumn,
} from "@/lib/rankings/column-config";
import { getPlayerRosterRatesMap } from "@/lib/queries/player-roster-rates";
import { getNflTeamSchedule } from "@/lib/espn/team-schedule";
import { getNflState } from "@/lib/sleeper/api";
import { resolvePlayerByeWeek } from "@/lib/nfl/bye-weeks";

export type PlayerProfileGameLogRow = {
  week: number;
  opponent: string | null;
  stats: Record<string, number | null>;
  fantasyPts: number | null;
};

export type PlayerProfileTransactionKind =
  | "drafted"
  | "traded"
  | "added"
  | "claimed"
  | "dropped";

export type PlayerProfileActivityRow = {
  id: string;
  type: PlayerProfileTransactionKind;
  label: string;
  summary: string;
  createdAt: Date;
  teamName: string | null;
};

export type PlayerProfile = {
  id: string;
  fullName: string;
  nflTeam: string | null;
  primaryPositionId: string;
  sleeperId: string | null;
  yearsExp: number | null;
  byeWeek: number | null;
  injuryStatus: string | null;
  rookieYear: string | null;
  age: number | null;
  height: string | null;
  weight: string | null;
  college: string | null;
  jerseyNumber: number | null;
  season: string;
  ownedPct: number | null;
  startPct: number | null;
  positionRank: number | null;
  seasonProjection: {
    fantasyPts: number | null;
    stats: Record<string, number | null>;
  } | null;
  seasonStats: {
    fantasyPts: number | null;
    stats: Record<string, number | null>;
  } | null;
  gameLog: PlayerProfileGameLogRow[];
  gameLogColumns: StatColumn[];
  ownership: {
    fantasyTeamId: string | null;
    fantasyTeamName: string | null;
    fantasyTeamSlug: string | null;
    isOwnedByCurrentUser: boolean;
    onWaivers: boolean;
    acquisitionKind: "add" | "claim" | "owned" | "unavailable";
    hasPendingClaim: boolean;
  } | null;
  isWatched: boolean;
  activity: PlayerProfileActivityRow[];
  leagueSlug: string | null;
};

function parsePositionFilter(value: string): PositionFilter {
  if (
    value === "QB" ||
    value === "RB" ||
    value === "WR" ||
    value === "TE" ||
    value === "K" ||
    value === "DEF"
  ) {
    return value;
  }
  return "WR";
}

function scoreRow(
  stats: Record<string, number | null>,
  positionId: string,
  rules: ScoringRuleDefinition[],
) {
  return calculatePlayerPoints(stats, positionId, rules);
}

function pickPositionRank(stats: Record<string, number | null>): number | null {
  const sleeperRank =
    stats.pos_rank_ppr ??
    stats.pos_rank_std ??
    stats.pos_adp_dd_ppr ??
    stats.pos_rank_half_ppr;
  if (sleeperRank && sleeperRank > 0 && sleeperRank < 999) {
    return Math.round(sleeperRank);
  }
  return null;
}

/** Rank player among season projections at their position (league scoring). */
async function computeProjectionPositionRank(input: {
  playerId: string;
  positionId: string;
  season: string;
  rules: ScoringRuleDefinition[];
}): Promise<number | null> {
  const rows = await db
    .select({
      playerId: playerScores.playerId,
      stats: playerScores.stats,
    })
    .from(playerScores)
    .innerJoin(players, eq(players.id, playerScores.playerId))
    .where(
      and(
        eq(playerScores.season, input.season),
        eq(playerScores.week, 0),
        eq(playerScores.kind, "projection"),
        eq(playerScores.seasonType, "regular"),
        eq(players.primaryPositionId, input.positionId),
      ),
    );

  if (rows.length === 0) {
    return null;
  }

  const ranked = rows
    .map((row) => {
      const stats = normalizePlayerStats(
        (row.stats ?? {}) as Record<string, number | null>,
      ) as Record<string, number | null>;
      return {
        playerId: row.playerId,
        fantasyPts: scoreRow(stats, input.positionId, input.rules) ?? 0,
      };
    })
    .toSorted((a, b) => b.fantasyPts - a.fantasyPts);

  const index = ranked.findIndex((row) => row.playerId === input.playerId);
  return index >= 0 ? index + 1 : null;
}

async function loadPriorSeasonPosRank(input: {
  playerId: string;
  season: string;
}): Promise<number | null> {
  const priorSeason = String(Number(input.season) - 1);
  if (!/^\d{4}$/.test(priorSeason)) {
    return null;
  }

  const [row] = await db
    .select({ stats: playerScores.stats })
    .from(playerScores)
    .where(
      and(
        eq(playerScores.playerId, input.playerId),
        eq(playerScores.season, priorSeason),
        eq(playerScores.week, 0),
        eq(playerScores.kind, "stats"),
        eq(playerScores.seasonType, "regular"),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const stats = normalizePlayerStats(
    (row.stats ?? {}) as Record<string, number | null>,
  ) as Record<string, number | null>;
  return pickPositionRank(stats);
}

async function loadScoreBundle(input: {
  playerId: string;
  season: string;
  positionId: string;
  rules: ScoringRuleDefinition[];
}) {
  const rows = await db
    .select({
      week: playerScores.week,
      kind: playerScores.kind,
      stats: playerScores.stats,
    })
    .from(playerScores)
    .where(
      and(
        eq(playerScores.playerId, input.playerId),
        eq(playerScores.season, input.season),
        eq(playerScores.seasonType, "regular"),
        inArray(playerScores.kind, ["projection", "stats"]),
      ),
    )
    .orderBy(asc(playerScores.week));

  let seasonProjection: PlayerProfile["seasonProjection"] = null;
  let seasonStats: PlayerProfile["seasonStats"] = null;
  const gameLog: PlayerProfileGameLogRow[] = [];

  for (const row of rows) {
    const stats = normalizePlayerStats(
      (row.stats ?? {}) as Record<string, number | null>,
    ) as Record<string, number | null>;
    const fantasyPts = scoreRow(stats, input.positionId, input.rules);

    if (row.kind === "projection" && row.week === 0) {
      seasonProjection = { fantasyPts, stats };
      continue;
    }

    if (row.kind === "stats" && row.week === 0) {
      seasonStats = { fantasyPts, stats };
      continue;
    }

    if (row.kind === "stats" && row.week >= 1 && row.week <= 18) {
      gameLog.push({ week: row.week, opponent: null, stats, fantasyPts });
    }
  }

  return { seasonProjection, seasonStats, gameLog };
}

function mergeGameLogWithSchedule(input: {
  gameLog: PlayerProfileGameLogRow[];
  schedule: Array<{ week: number; opponent: string }>;
}): PlayerProfileGameLogRow[] {
  const statsByWeek = new Map(
    input.gameLog.map((row) => [row.week, row] as const),
  );

  if (input.schedule.length === 0) {
    return input.gameLog;
  }

  return input.schedule.map((slot) => {
    const existing = statsByWeek.get(slot.week);
    return {
      week: slot.week,
      opponent: slot.opponent,
      stats: existing?.stats ?? {},
      fantasyPts: existing?.fantasyPts ?? null,
    };
  });
}

const PLAYER_TXN_ACTIVITY_TYPES = [
  "player_added",
  "player_dropped",
  "waiver_awarded",
] as const;

function liveTeamName(
  summary: string,
  meta: LeagueActivityMetadata | null,
  teamName: string | null,
) {
  const stale = meta?.teamName?.trim();
  const live = teamName?.trim();
  if (stale && live && stale !== live && summary.includes(stale)) {
    return summary.split(stale).join(live);
  }
  return summary;
}

async function loadPlayerTransactionHistory(input: {
  leagueSeasonId: string;
  playerId: string;
  playerName: string;
}): Promise<PlayerProfileActivityRow[]> {
  const rows: PlayerProfileActivityRow[] = [];

  const [draftPick] = await db
    .select({
      id: draftPicks.id,
      round: draftPicks.round,
      overall: draftPicks.overall,
      madeAt: draftPicks.madeAt,
      teamName: teams.name,
    })
    .from(draftPicks)
    .innerJoin(drafts, eq(draftPicks.draftId, drafts.id))
    .innerJoin(teams, eq(draftPicks.teamId, teams.id))
    .where(
      and(
        eq(drafts.leagueSeasonId, input.leagueSeasonId),
        eq(draftPicks.playerId, input.playerId),
      ),
    )
    .limit(1);

  if (draftPick) {
    rows.push({
      id: `draft-${draftPick.id}`,
      type: "drafted",
      label: "Drafted",
      summary: `${draftPick.teamName} drafted ${input.playerName} (Rd ${draftPick.round}, Pick ${draftPick.overall})`,
      createdAt: draftPick.madeAt,
      teamName: draftPick.teamName,
    });
  }

  const activityRows = await db
    .select({
      id: leagueActivity.id,
      type: leagueActivity.type,
      summary: leagueActivity.summary,
      createdAt: leagueActivity.createdAt,
      teamName: teams.name,
      playerId: leagueActivity.playerId,
      relatedPlayerId: leagueActivity.relatedPlayerId,
      metadata: leagueActivity.metadata,
    })
    .from(leagueActivity)
    .leftJoin(teams, eq(leagueActivity.teamId, teams.id))
    .where(
      and(
        eq(leagueActivity.leagueSeasonId, input.leagueSeasonId),
        inArray(leagueActivity.type, [...PLAYER_TXN_ACTIVITY_TYPES]),
        or(
          eq(leagueActivity.playerId, input.playerId),
          eq(leagueActivity.relatedPlayerId, input.playerId),
        ),
      ),
    )
    .orderBy(desc(leagueActivity.createdAt))
    .limit(40);

  for (const row of activityRows) {
    const meta = (row.metadata ?? null) as LeagueActivityMetadata | null;
    const summary = liveTeamName(row.summary, meta, row.teamName);
    const teamName = row.teamName?.trim() ?? null;

    if (row.type === "player_added" && row.playerId === input.playerId) {
      rows.push({
        id: row.id,
        type: "added",
        label: "Added",
        summary,
        createdAt: row.createdAt,
        teamName,
      });
      continue;
    }

    if (row.type === "player_dropped" && row.playerId === input.playerId) {
      rows.push({
        id: row.id,
        type: "dropped",
        label: "Dropped",
        summary,
        createdAt: row.createdAt,
        teamName,
      });
      continue;
    }

    if (row.type === "waiver_awarded") {
      if (row.playerId === input.playerId) {
        rows.push({
          id: row.id,
          type: "claimed",
          label: "Claimed",
          summary,
          createdAt: row.createdAt,
          teamName,
        });
      } else if (row.relatedPlayerId === input.playerId) {
        rows.push({
          id: `${row.id}-drop`,
          type: "dropped",
          label: "Dropped",
          summary: teamName
            ? `${teamName} dropped ${input.playerName}`
            : `${input.playerName} dropped`,
          createdAt: row.createdAt,
          teamName,
        });
      }
    }
  }

  const offeringTeam = alias(teams, "offering_team");
  const proposingTeam = alias(teams, "proposing_team");
  const receivingTeam = alias(teams, "receiving_team");

  const tradeRows = await db
    .select({
      tradeId: trades.id,
      completedAt: trades.completedAt,
      proposingTeamId: trades.proposingTeamId,
      receivingTeamId: trades.receivingTeamId,
      offeringTeamId: tradePlayers.teamId,
      isDrop: tradePlayers.isDrop,
      offeringTeamName: offeringTeam.name,
      proposingTeamName: proposingTeam.name,
      receivingTeamName: receivingTeam.name,
    })
    .from(tradePlayers)
    .innerJoin(trades, eq(tradePlayers.tradeId, trades.id))
    .innerJoin(offeringTeam, eq(tradePlayers.teamId, offeringTeam.id))
    .innerJoin(proposingTeam, eq(trades.proposingTeamId, proposingTeam.id))
    .innerJoin(receivingTeam, eq(trades.receivingTeamId, receivingTeam.id))
    .where(
      and(
        eq(trades.leagueSeasonId, input.leagueSeasonId),
        eq(trades.status, "completed"),
        eq(tradePlayers.playerId, input.playerId),
      ),
    );

  for (const row of tradeRows) {
    const createdAt = row.completedAt ?? new Date(0);
    if (row.isDrop) {
      rows.push({
        id: `trade-drop-${row.tradeId}`,
        type: "dropped",
        label: "Dropped",
        summary: `${row.offeringTeamName} dropped ${input.playerName}`,
        createdAt,
        teamName: row.offeringTeamName,
      });
      continue;
    }

    const toTeamName =
      row.offeringTeamId === row.proposingTeamId
        ? row.receivingTeamName
        : row.proposingTeamName;

    rows.push({
      id: `trade-${row.tradeId}`,
      type: "traded",
      label: "Traded",
      summary: `Traded from ${row.offeringTeamName} to ${toTeamName}`,
      createdAt,
      teamName: toTeamName,
    });
  }

  return rows.toSorted(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export const getPlayerProfile = cache(
  async (input: {
    playerId: string;
    leagueSlug?: string | null;
    season?: string | null;
  }): Promise<PlayerProfile | null> => {
    const [player] = await db
      .select({
        id: players.id,
        fullName: players.fullName,
        nflTeam: players.nflTeam,
        primaryPositionId: players.primaryPositionId,
        sleeperId: playerExternalIds.externalId,
        yearsExp: players.yearsExp,
        byeWeek: players.byeWeek,
        injuryStatus: players.injuryStatus,
        rookieYear: players.rookieYear,
        age: players.age,
        height: players.height,
        weight: players.weight,
        college: players.college,
        jerseyNumber: players.jerseyNumber,
      })
      .from(players)
      .leftJoin(
        playerExternalIds,
        and(
          eq(playerExternalIds.playerId, players.id),
          eq(playerExternalIds.provider, "sleeper"),
        ),
      )
      .where(eq(players.id, input.playerId))
      .limit(1);

    if (!player) {
      return null;
    }

    const nflState = await getNflState().catch(() => null);
    const season =
      input.season ?? nflState?.season ?? new Date().getFullYear().toString();

    let scoringRules = getDefaultScoringRuleDefinitions("full_ppr");
    let leagueSlug: string | null = null;
    let ownership: PlayerProfile["ownership"] = null;
    let isWatched = false;
    let activity: PlayerProfileActivityRow[] = [];

    const user = await getSessionUser();

    if (input.leagueSlug) {
      const league = await getLeagueBySlug(input.leagueSlug);
      if (league) {
        leagueSlug = league.publicId;
        const seasonRow = await getLeagueSeason(league.id);
        if (seasonRow) {
          scoringRules = resolveScoringRuleDefinitions(
            seasonRow.scoringPreset as ScoringPreset,
            seasonRow.settings.scoringRules,
          );

          if (user) {
            const membership = await getLeagueMembership(league.id, user.id);
            if (membership) {
              const ownershipMap = await getLeaguePlayerOwnershipMap(
                seasonRow.id,
                user.id,
              );
              const owned = resolvePlayerOwnership(ownershipMap, player.id);
              const wire = resolveWaiverWireSettings(
                seasonRow.settings.waiverWire,
              );
              const acquisitionKind = resolvePlayerAcquisitionKind({
                waiversEnabled: Boolean(seasonRow.waiversEnabled),
                waiverWire: wire,
                rosterTransactionsEnabled:
                  isRosterTransactionsEnabled(seasonRow),
                fantasyTeamId: owned.fantasyTeamId,
                onWaivers: owned.onWaivers,
                nflTeam: player.nflTeam,
              });

              const userTeam = await getUserTeamForSeason(
                seasonRow.id,
                user.id,
              );
              let hasPendingClaim = false;
              if (userTeam) {
                const watchIds = await getTeamWatchlistPlayerIds(userTeam.id);
                isWatched = watchIds.includes(player.id);

                const [pending] = await db
                  .select({ id: waiverClaims.id })
                  .from(waiverClaims)
                  .where(
                    and(
                      eq(waiverClaims.teamId, userTeam.id),
                      eq(waiverClaims.playerId, player.id),
                      eq(waiverClaims.status, "pending"),
                    ),
                  )
                  .limit(1);
                hasPendingClaim = Boolean(pending);
              }

              ownership = {
                fantasyTeamId: owned.fantasyTeamId,
                fantasyTeamName: owned.fantasyTeamName,
                fantasyTeamSlug: owned.fantasyTeamSlug,
                isOwnedByCurrentUser: owned.isOwnedByCurrentUser,
                onWaivers: owned.onWaivers,
                acquisitionKind,
                hasPendingClaim,
              };

              activity = await loadPlayerTransactionHistory({
                leagueSeasonId: seasonRow.id,
                playerId: player.id,
                playerName: player.fullName,
              });
            }
          }
        }
      }
    }

    const byeWeek = resolvePlayerByeWeek({
      byeWeek: player.byeWeek,
      nflTeam: player.nflTeam,
    });

    const [
      { seasonProjection, seasonStats, gameLog: scoreGameLog },
      ratesMap,
      positionRank,
      schedule,
    ] = await Promise.all([
      loadScoreBundle({
        playerId: player.id,
        season,
        positionId: player.primaryPositionId,
        rules: scoringRules,
      }),
      getPlayerRosterRatesMap([player.id]),
      computeProjectionPositionRank({
        playerId: player.id,
        positionId: player.primaryPositionId,
        season,
        rules: scoringRules,
      }).then(async (rank) => {
        if (rank != null) return rank;
        return loadPriorSeasonPosRank({ playerId: player.id, season });
      }),
      getNflTeamSchedule({
        nflTeam: player.nflTeam,
        season,
        byeWeek,
      }),
    ]);

    const gameLog = mergeGameLogWithSchedule({
      gameLog: scoreGameLog,
      schedule,
    });

    const rates = ratesMap.get(player.id);
    const position = parsePositionFilter(player.primaryPositionId);
    const gameLogColumns = getStatColumns(position).filter(
      (column) => column.key !== "fantasy_pts" && column.key !== "adp",
    );

    return {
      id: player.id,
      fullName: player.fullName,
      nflTeam: player.nflTeam,
      primaryPositionId: player.primaryPositionId,
      sleeperId: player.sleeperId,
      yearsExp: player.yearsExp,
      byeWeek: player.byeWeek,
      injuryStatus: player.injuryStatus,
      rookieYear: player.rookieYear,
      age: player.age,
      height: player.height,
      weight: player.weight,
      college: player.college,
      jerseyNumber: player.jerseyNumber,
      season,
      ownedPct: rates?.ownedPct ?? null,
      startPct: rates?.startPct ?? null,
      positionRank,
      seasonProjection,
      seasonStats,
      gameLog,
      gameLogColumns,
      ownership,
      isWatched,
      activity,
      leagueSlug,
    };
  },
);
