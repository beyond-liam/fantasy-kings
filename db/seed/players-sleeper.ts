import "./load-env";

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  playerExternalIds,
  players,
} from "../schema";
import { createSeedClient } from "./client";
import { generatePublicId } from "../../lib/leagues/public-id";
import { resolveSleeperPrimaryPosition } from "../../lib/players/resolve-sleeper-position";

const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";

type SleeperPlayer = {
  player_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  team: string | null;
  position: string | null;
  fantasy_positions: string[] | null;
  active: boolean;
  search_rank: number | null;
  years_exp: number | null;
  bye_week: number | null;
  injury_status: string | null;
  age: number | null;
  height: string | null;
  weight: string | null;
  college: string | null;
  number: number | null;
  /** ESPN athlete id when Sleeper has a crosswalk. */
  espn_id: number | string | null;
  depth_chart_order: number | null;
  depth_chart_position: string | null;
  metadata: { rookie_year?: string | null } | null;
};

function resolveEspnId(
  value: number | string | null | undefined,
): string | null {
  if (value == null || value === "") {
    return null;
  }
  const asString = String(value).trim();
  return asString || null;
}

function resolveJerseyNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveDepthChartOrder(
  value: number | null | undefined,
): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

function resolveAge(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveDisplayName(player: SleeperPlayer): string | null {
  if (player.full_name?.trim()) {
    return player.full_name.trim();
  }

  const first = player.first_name?.trim() ?? "";
  const last = player.last_name?.trim() ?? "";
  const combined = `${first} ${last}`.trim();

  return combined || null;
}

function resolvePosition(player: SleeperPlayer): string | null {
  return resolveSleeperPrimaryPosition({
    active: player.active,
    position: player.position,
    fantasy_positions: player.fantasy_positions,
    team: player.team,
    hasDisplayName: Boolean(resolveDisplayName(player)),
    depth_chart_position: player.depth_chart_position,
  });
}

async function seedSleeperPlayers() {
  const response = await fetch(SLEEPER_PLAYERS_URL);
  if (!response.ok) {
    throw new Error(`Sleeper API failed: ${response.status}`);
  }

  const sleeperPlayers = Object.values(
    (await response.json()) as Record<string, SleeperPlayer>,
  );

  const toImport = sleeperPlayers
    .map((player) => {
      const positionId = resolvePosition(player);
      const displayName = resolveDisplayName(player);
      if (!positionId || !displayName) {
        return null;
      }

      return {
        sleeperId: player.player_id,
        espnId: resolveEspnId(player.espn_id),
        fullName: displayName,
        nflTeam: player.team,
        primaryPositionId: positionId,
        sleeperSearchRank:
          typeof player.search_rank === "number" ? player.search_rank : null,
        yearsExp:
          typeof player.years_exp === "number" ? player.years_exp : null,
        byeWeek:
          typeof player.bye_week === "number" ? player.bye_week : null,
        injuryStatus: player.injury_status,
        rookieYear: player.metadata?.rookie_year ?? null,
        age: resolveAge(player.age),
        height: resolveText(player.height),
        weight: resolveText(player.weight),
        college: resolveText(player.college),
        jerseyNumber: resolveJerseyNumber(player.number),
        depthChartOrder: resolveDepthChartOrder(player.depth_chart_order),
      };
    })
    .filter((player): player is NonNullable<typeof player> => player !== null);

  const client = createSeedClient();
  const db = drizzle(client);

  const existingExternalIds = await db
    .select({
      externalId: playerExternalIds.externalId,
      playerId: playerExternalIds.playerId,
    })
    .from(playerExternalIds)
    .where(eq(playerExternalIds.provider, "sleeper"));

  const externalIdToPlayerId = new Map(
    existingExternalIds.map((row) => [row.externalId, row.playerId]),
  );

  const existingPublicIdRows = await db
    .select({ publicId: players.publicId })
    .from(players)
    .where(isNotNull(players.publicId));
  const usedPublicIds = new Set(
    existingPublicIdRows
      .map((row) => row.publicId)
      .filter((id): id is string => Boolean(id)),
  );

  function nextPlayerPublicId(): string {
    let publicId = generatePublicId();
    while (usedPublicIds.has(publicId)) {
      publicId = generatePublicId();
    }
    usedPublicIds.add(publicId);
    return publicId;
  }

  const existingPlayerIds = [...externalIdToPlayerId.values()];
  const previousInjuryById = new Map<string, string | null>();
  if (existingPlayerIds.length > 0) {
    const previousRows = await db
      .select({
        id: players.id,
        injuryStatus: players.injuryStatus,
      })
      .from(players)
      .where(inArray(players.id, existingPlayerIds));
    for (const row of previousRows) {
      previousInjuryById.set(row.id, row.injuryStatus);
    }
  }

  const injuryChanges: Array<{
    playerId: string;
    fullName: string;
    previousStatus: string | null;
    nextStatus: string | null;
  }> = [];

  const counts: Record<string, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
    CB: 0,
    S: 0,
    DT: 0,
    DE: 0,
    LB: 0,
  };

  let inserted = 0;
  let updated = 0;
  let espnLinked = 0;

  const activeSleeperIds = new Set(toImport.map((player) => player.sleeperId));

  const existingEspnRows = await db
    .select({
      externalId: playerExternalIds.externalId,
      playerId: playerExternalIds.playerId,
    })
    .from(playerExternalIds)
    .where(eq(playerExternalIds.provider, "espn"));
  const espnExternalIdToPlayerId = new Map(
    existingEspnRows.map((row) => [row.externalId, row.playerId]),
  );
  const playerIdToEspnExternalId = new Map(
    existingEspnRows.map((row) => [row.playerId, row.externalId]),
  );

  async function syncEspnExternalId(
    playerId: string,
    espnId: string | null,
  ): Promise<void> {
    if (!espnId) {
      return;
    }

    const existingForEspn = espnExternalIdToPlayerId.get(espnId);
    if (existingForEspn === playerId) {
      return;
    }

    const previousEspnId = playerIdToEspnExternalId.get(playerId);
    if (previousEspnId && previousEspnId !== espnId) {
      await db
        .delete(playerExternalIds)
        .where(
          and(
            eq(playerExternalIds.provider, "espn"),
            eq(playerExternalIds.externalId, previousEspnId),
          ),
        );
      espnExternalIdToPlayerId.delete(previousEspnId);
      playerIdToEspnExternalId.delete(playerId);
    }

    if (existingForEspn && existingForEspn !== playerId) {
      // Another player already owns this ESPN id — skip rather than collide.
      return;
    }

    await db.insert(playerExternalIds).values({
      playerId,
      provider: "espn",
      externalId: espnId,
    });
    espnExternalIdToPlayerId.set(espnId, playerId);
    playerIdToEspnExternalId.set(playerId, espnId);
    espnLinked++;
  }

  for (const player of toImport) {
    const existingPlayerId = externalIdToPlayerId.get(player.sleeperId);

    if (existingPlayerId) {
      const previousStatus = previousInjuryById.get(existingPlayerId) ?? null;
      await db
        .update(players)
        .set({
          fullName: player.fullName,
          nflTeam: player.nflTeam,
          primaryPositionId: player.primaryPositionId,
          sleeperSearchRank: player.sleeperSearchRank,
          yearsExp: player.yearsExp,
          byeWeek: player.byeWeek,
          injuryStatus: player.injuryStatus,
          rookieYear: player.rookieYear,
          age: player.age,
          height: player.height,
          weight: player.weight,
          college: player.college,
          jerseyNumber: player.jerseyNumber,
          depthChartOrder: player.depthChartOrder,
          updatedAt: new Date(),
        })
        .where(eq(players.id, existingPlayerId));
      if ((previousStatus ?? null) !== (player.injuryStatus ?? null)) {
        injuryChanges.push({
          playerId: existingPlayerId,
          fullName: player.fullName,
          previousStatus,
          nextStatus: player.injuryStatus,
        });
      }
      await syncEspnExternalId(existingPlayerId, player.espnId);
      updated++;
    } else {
      const [created] = await db
        .insert(players)
        .values({
          publicId: nextPlayerPublicId(),
          fullName: player.fullName,
          nflTeam: player.nflTeam,
          primaryPositionId: player.primaryPositionId,
          sleeperSearchRank: player.sleeperSearchRank,
          yearsExp: player.yearsExp,
          byeWeek: player.byeWeek,
          injuryStatus: player.injuryStatus,
          rookieYear: player.rookieYear,
          age: player.age,
          height: player.height,
          weight: player.weight,
          college: player.college,
          jerseyNumber: player.jerseyNumber,
          depthChartOrder: player.depthChartOrder,
        })
        .returning({ id: players.id });

      await db.insert(playerExternalIds).values({
        playerId: created.id,
        provider: "sleeper",
        externalId: player.sleeperId,
      });

      externalIdToPlayerId.set(player.sleeperId, created.id);
      await syncEspnExternalId(created.id, player.espnId);
      inserted++;
    }

    counts[player.primaryPositionId]++;
  }

  if (injuryChanges.length > 0) {
    try {
      const { announceRosterInjuryChanges } = await import(
        "@/lib/alerts/injuries"
      );
      await announceRosterInjuryChanges({ changes: injuryChanges });
    } catch (error) {
      console.error("[seed] injury notifications failed", error);
    }
  }

  // Prefer ESPN roster name/team matches — Sleeper espn_id coverage is sparse.
  const playersForEspnMatch = toImport.flatMap((player) => {
    const playerId = externalIdToPlayerId.get(player.sleeperId);
    if (!playerId || !player.nflTeam) {
      return [];
    }
    return [
      {
        playerId,
        fullName: player.fullName,
        nflTeam: player.nflTeam,
        primaryPositionId: player.primaryPositionId,
        jerseyNumber: player.jerseyNumber,
      },
    ];
  });

  try {
    const { matchPlayersToEspnIds } = await import("@/lib/espn/rosters");
    const rosterMatches = await matchPlayersToEspnIds(playersForEspnMatch);
    for (const [playerId, espnId] of rosterMatches) {
      await syncEspnExternalId(playerId, espnId);
    }
    console.log(`ESPN roster matches applied: ${rosterMatches.size}`);
  } catch (error) {
    console.error("[seed] ESPN roster id backfill failed", error);
  }

  const inactivePlayerIds = existingExternalIds
    .filter((row) => !activeSleeperIds.has(row.externalId))
    .map((row) => row.playerId);

  let removed = 0;
  if (inactivePlayerIds.length > 0) {
    const deleted = await db
      .delete(players)
      .where(inArray(players.id, inactivePlayerIds))
      .returning({ id: players.id });
    removed = deleted.length;
  }

  const linkedRows = await db
    .select({ playerId: playerExternalIds.playerId })
    .from(playerExternalIds);
  const linkedIdSet = new Set(linkedRows.map((row) => row.playerId));

  const allPlayerRows = await db.select({ id: players.id }).from(players);
  const orphanIds = allPlayerRows
    .filter((row) => !linkedIdSet.has(row.id))
    .map((row) => row.id);

  let orphansRemoved = 0;
  if (orphanIds.length > 0) {
    const deleted = await db
      .delete(players)
      .where(inArray(players.id, orphanIds))
      .returning({ id: players.id });
    orphansRemoved = deleted.length;
  }

  await client.end();

  console.log(`Imported ${toImport.length} active players from Sleeper.`);
  console.log(`Inserted: ${inserted}, Updated: ${updated}, Removed: ${removed}`);
  console.log(`ESPN ids linked this run: ${espnLinked}`);
  if (orphansRemoved > 0) {
    console.log(`Removed ${orphansRemoved} players without Sleeper IDs.`);
  }
  console.log("Counts by position:");
  for (const [position, count] of Object.entries(counts)) {
    console.log(`  ${position}: ${count}`);
  }
}

seedSleeperPlayers().catch((error) => {
  console.error(error);
  process.exit(1);
});
