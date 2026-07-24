import { and, eq, max, sql } from "drizzle-orm";

import { playerScores } from "@/db/schema";
import { db } from "@/lib/db";
import {
  fetchNflverseWeekStatLines,
  loadNflverseGsisToEspnMap,
} from "@/lib/nflverse/player-week-stats";
import { clearScoreRowsCache } from "@/lib/queries/players";
import { loadEspnPlayerIdMap } from "@/lib/scores/sync-espn-scores";
import { getNflState } from "@/lib/sleeper/api";

const UPSERT_CHUNK_SIZE = 100;

type ScoresDb = typeof db;

export type SyncNflverseWeekScoresResult = {
  ok: true;
  season: string;
  week: number;
  nflverseRows: number;
  upserted: number;
  matchedPlayers: number;
  unmappedPlayers: number;
  maxUpdatedAt: string | null;
  durationMs: number;
  skipped?: boolean;
  reason?: string;
};

async function maxUpdatedAtForWeek(input: {
  season: string;
  week: number;
}): Promise<Date | null> {
  const [row] = await db
    .select({ value: max(playerScores.updatedAt) })
    .from(playerScores)
    .where(
      and(
        eq(playerScores.season, input.season),
        eq(playerScores.week, input.week),
        eq(playerScores.seasonType, "regular"),
        eq(playerScores.kind, "stats"),
      ),
    );
  return row?.value ?? null;
}

/**
 * Replace `player_scores` (kind=stats) for a week from nflverse official box scores.
 * Uses gsis → espn → Fantasy Kings player id.
 */
export async function syncNflverseWeekScores(options?: {
  week?: number;
  season?: string;
  executor?: ScoresDb;
}): Promise<SyncNflverseWeekScoresResult> {
  const started = Date.now();
  const executor = options?.executor ?? db;
  const state = await getNflState({ fresh: true });

  const hasWeekOverride = options?.week != null;
  const hasSeasonOverride =
    options?.season != null && options.season.trim() !== "";

  let season = hasSeasonOverride ? options.season!.trim() : state.season;
  const week = hasWeekOverride
    ? options.week!
    : (state.display_week ?? state.week);

  const sleeperOffseason =
    !hasWeekOverride &&
    (state.season_type === "off" ||
      !Number.isFinite(week) ||
      week < 1);

  if (sleeperOffseason) {
    return {
      ok: true,
      skipped: true,
      reason:
        "Sleeper is in offseason (week 0). Pass ?season=YYYY&week=N to sync a prior week.",
      season: state.season,
      week: 0,
      nflverseRows: 0,
      upserted: 0,
      matchedPlayers: 0,
      unmappedPlayers: 0,
      maxUpdatedAt: null,
      durationMs: Date.now() - started,
    };
  }

  if (
    hasWeekOverride &&
    !hasSeasonOverride &&
    (state.season_type === "off" ||
      state.display_week === 0 ||
      state.week === 0)
  ) {
    season = state.previous_season;
  }

  if (!Number.isFinite(week) || week < 1 || week > 18) {
    throw new Error(`Invalid fantasy week for nflverse sync: ${week}`);
  }

  const [gsisToEspn, espnIdToPlayerId] = await Promise.all([
    loadNflverseGsisToEspnMap(),
    loadEspnPlayerIdMap(executor),
  ]);

  if (espnIdToPlayerId.size === 0) {
    return {
      ok: true,
      skipped: true,
      reason:
        "No ESPN player id mappings yet. Re-run the Sleeper players seed first.",
      season,
      week,
      nflverseRows: 0,
      upserted: 0,
      matchedPlayers: 0,
      unmappedPlayers: 0,
      maxUpdatedAt: null,
      durationMs: Date.now() - started,
    };
  }

  const lines = await fetchNflverseWeekStatLines({
    season,
    week,
    gsisToEspn,
  });

  const values: Array<{
    playerId: string;
    season: string;
    week: number;
    seasonType: "regular";
    kind: "stats";
    stats: Record<string, number>;
    gp: number;
  }> = [];
  let unmapped = 0;

  for (const line of lines) {
    if (!line.espnId) {
      unmapped++;
      continue;
    }
    const playerId = espnIdToPlayerId.get(line.espnId);
    if (!playerId) {
      unmapped++;
      continue;
    }
    values.push({
      playerId,
      season,
      week,
      seasonType: "regular",
      kind: "stats",
      stats: line.stats,
      gp: 1,
    });
  }

  for (let i = 0; i < values.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = values.slice(i, i + UPSERT_CHUNK_SIZE);
    await executor
      .insert(playerScores)
      .values(chunk)
      .onConflictDoUpdate({
        target: [
          playerScores.playerId,
          playerScores.season,
          playerScores.week,
          playerScores.seasonType,
          playerScores.kind,
        ],
        set: {
          // Official replace — do not merge with live ESPN/Sleeper leftovers.
          stats: sql`excluded.stats`,
          gp: sql`excluded.gp`,
          updatedAt: new Date(),
        },
      });
  }

  if (values.length > 0) {
    clearScoreRowsCache();
  }

  const maxUpdated = await maxUpdatedAtForWeek({ season, week });

  return {
    ok: true,
    season,
    week,
    nflverseRows: lines.length,
    upserted: values.length,
    matchedPlayers: espnIdToPlayerId.size,
    unmappedPlayers: unmapped,
    maxUpdatedAt: maxUpdated?.toISOString() ?? null,
    durationMs: Date.now() - started,
  };
}
