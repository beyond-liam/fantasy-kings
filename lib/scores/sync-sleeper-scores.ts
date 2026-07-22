import { and, eq, inArray, max, sql } from "drizzle-orm";

import { playerExternalIds, playerScores } from "@/db/schema";
import { db } from "@/lib/db";
import { clearScoreRowsCache } from "@/lib/queries/players";
import {
  fetchSleeperScores,
  getNflState,
  type SleeperScoreRow,
} from "@/lib/sleeper/api";

const UPSERT_CHUNK_SIZE = 100;

export type SyncScoresKind = "stats" | "projection";

export type UpsertSleeperScoresResult = {
  sleeperRows: number;
  upserted: number;
};

export type SyncCurrentWeekScoresResult = {
  ok: true;
  season: string;
  week: number;
  kinds: SyncScoresKind[];
  upserted: number;
  sleeperRows: number;
  matchedPlayers: number;
  maxUpdatedAt: string | null;
  durationMs: number;
  /** True when Sleeper has no active week (offseason) and no override was passed. */
  skipped?: boolean;
  reason?: string;
};

type ScoresDb = typeof db;

function scoreValuesFromSleeperRows(input: {
  rows: SleeperScoreRow[];
  sleeperIdToPlayerId: Map<string, string>;
  kind: SyncScoresKind;
  season: string;
  week: number | null;
}) {
  const weekValue = input.week ?? 0;
  const values: Array<{
    playerId: string;
    season: string;
    week: number;
    seasonType: "regular";
    kind: SyncScoresKind;
    stats: Record<string, number | null>;
    ptsPpr: number | null;
    ptsStd: number | null;
    gp: number | null;
  }> = [];

  for (const row of input.rows) {
    const playerId = input.sleeperIdToPlayerId.get(row.player_id);
    if (!playerId || !row.stats) {
      continue;
    }

    const stats = row.stats;
    values.push({
      playerId,
      season: input.season,
      week: weekValue,
      seasonType: "regular",
      kind: input.kind,
      stats,
      ptsPpr: typeof stats.pts_ppr === "number" ? stats.pts_ppr : null,
      ptsStd: typeof stats.pts_std === "number" ? stats.pts_std : null,
      gp: typeof stats.gp === "number" ? stats.gp : null,
    });
  }

  return values;
}

/** Load Sleeper external id → internal player id map. */
export async function loadSleeperPlayerIdMap(
  executor: ScoresDb = db,
): Promise<Map<string, string>> {
  const externalIds = await executor
    .select({
      externalId: playerExternalIds.externalId,
      playerId: playerExternalIds.playerId,
    })
    .from(playerExternalIds)
    .where(eq(playerExternalIds.provider, "sleeper"));

  return new Map(
    externalIds.map((row) => [row.externalId, row.playerId]),
  );
}

/**
 * Fetch one Sleeper scores batch and upsert into `player_scores`.
 * Shared by the seed script and the live sync cron.
 */
export async function upsertSleeperScoresBatch(
  executor: ScoresDb,
  sleeperIdToPlayerId: Map<string, string>,
  kind: SyncScoresKind,
  season: string,
  week: number | null,
): Promise<UpsertSleeperScoresResult> {
  const rows = await fetchSleeperScores(kind, season, week);
  const values = scoreValuesFromSleeperRows({
    rows,
    sleeperIdToPlayerId,
    kind,
    season,
    week,
  });

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
          stats: sql`excluded.stats`,
          ptsPpr: sql`excluded.pts_ppr`,
          ptsStd: sql`excluded.pts_std`,
          gp: sql`excluded.gp`,
          updatedAt: new Date(),
        },
      });
  }

  return {
    sleeperRows: rows.length,
    upserted: values.length,
  };
}

async function maxUpdatedAtForWeek(input: {
  season: string;
  week: number;
  kinds: SyncScoresKind[];
}): Promise<Date | null> {
  const [row] = await db
    .select({ value: max(playerScores.updatedAt) })
    .from(playerScores)
    .where(
      and(
        eq(playerScores.season, input.season),
        eq(playerScores.week, input.week),
        eq(playerScores.seasonType, "regular"),
        inArray(playerScores.kind, input.kinds),
      ),
    );

  return row?.value ?? null;
}

/**
 * Near-live scoring sync: pull current (or requested) week from Sleeper
 * and upsert into `player_scores`. Defaults to `stats` only.
 *
 * Offseason (Sleeper week 0): skips unless `week` / `season` overrides are
 * passed (e.g. season=2025&week=18 to verify the pipeline).
 */
export async function syncCurrentWeekScores(options?: {
  kinds?: SyncScoresKind[];
  /** Override week; defaults to Sleeper display_week / week. */
  week?: number;
  /** Override season string (e.g. "2025"). */
  season?: string;
}): Promise<SyncCurrentWeekScoresResult> {
  const started = Date.now();
  const state = await getNflState({ fresh: true });
  const kinds = options?.kinds ?? ["stats"];

  const hasWeekOverride = options?.week != null;
  const hasSeasonOverride =
    options?.season != null && options.season.trim() !== "";

  let season = hasSeasonOverride ? options.season!.trim() : state.season;
  let week = hasWeekOverride
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
      kinds,
      upserted: 0,
      sleeperRows: 0,
      matchedPlayers: 0,
      maxUpdatedAt: null,
      durationMs: Date.now() - started,
    };
  }

  // Week override during offseason without season → previous season has stats.
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
    throw new Error(`Invalid fantasy week for score sync: ${week}`);
  }

  const sleeperIdToPlayerId = await loadSleeperPlayerIdMap();
  let upserted = 0;
  let sleeperRows = 0;

  for (const kind of kinds) {
    const result = await upsertSleeperScoresBatch(
      db,
      sleeperIdToPlayerId,
      kind,
      season,
      week,
    );
    upserted += result.upserted;
    sleeperRows += result.sleeperRows;
  }

  clearScoreRowsCache();

  const maxUpdated = await maxUpdatedAtForWeek({ season, week, kinds });

  return {
    ok: true,
    season,
    week,
    kinds,
    upserted,
    sleeperRows,
    matchedPlayers: sleeperIdToPlayerId.size,
    maxUpdatedAt: maxUpdated?.toISOString() ?? null,
    durationMs: Date.now() - started,
  };
}
