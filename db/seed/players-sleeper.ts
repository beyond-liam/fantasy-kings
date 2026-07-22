import dotenv from "dotenv";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  playerExternalIds,
  players,
} from "../schema";
import { createSeedClient } from "./client";

dotenv.config({ path: ".env.local" });

const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const OFFENSE_POSITIONS = ["QB", "RB", "WR", "TE", "K"] as const;

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
  metadata: { rookie_year?: string | null } | null;
};

function resolveJerseyNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  if (!player.active) {
    return null;
  }

  const displayName = resolveDisplayName(player);
  if (!displayName) {
    return null;
  }

  const fantasyPositions = player.fantasy_positions ?? [];

  if (fantasyPositions.includes("DEF")) {
    return player.team ? "DEF" : null;
  }

  let positionId: string | null = null;

  if (
    player.position &&
    OFFENSE_POSITIONS.includes(
      player.position as (typeof OFFENSE_POSITIONS)[number],
    )
  ) {
    positionId = player.position;
  } else {
    for (const position of OFFENSE_POSITIONS) {
      if (fantasyPositions.includes(position)) {
        positionId = position;
        break;
      }
    }
  }

  if (!positionId || !player.team) {
    return null;
  }

  return positionId;
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

  const counts: Record<string, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
  };

  let inserted = 0;
  let updated = 0;

  const activeSleeperIds = new Set(toImport.map((player) => player.sleeperId));

  for (const player of toImport) {
    const existingPlayerId = externalIdToPlayerId.get(player.sleeperId);

    if (existingPlayerId) {
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
          updatedAt: new Date(),
        })
        .where(eq(players.id, existingPlayerId));
      updated++;
    } else {
      const [created] = await db
        .insert(players)
        .values({
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
        })
        .returning({ id: players.id });

      await db.insert(playerExternalIds).values({
        playerId: created.id,
        provider: "sleeper",
        externalId: player.sleeperId,
      });

      externalIdToPlayerId.set(player.sleeperId, created.id);
      inserted++;
    }

    counts[player.primaryPositionId]++;
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
