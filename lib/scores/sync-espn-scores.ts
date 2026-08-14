import { and, eq, max, sql } from "drizzle-orm";

import { playerExternalIds, playerScores, players } from "@/db/schema";
import { db } from "@/lib/db";
import {
  fetchEspnSummaryPayload,
  parseEspnPlayerBoxscore,
} from "@/lib/espn/player-boxscore";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import { parseEspnTeamDefBoxscore } from "@/lib/espn/team-def-boxscore";
import { espnSeasonTypeForNfl } from "@/lib/leagues/schedule/fantasy-week-map";
import { normalizeNflTeamAbbrev } from "@/lib/nfl/matchups";
import { clearScoreRowsCache } from "@/lib/queries/players";
import type { ScoreSyncSeasonType } from "@/lib/scores/sync-calendar";
import { getNflState } from "@/lib/sleeper/api";

const UPSERT_CHUNK_SIZE = 100;

type ScoresDb = typeof db;

export type SyncEspnLiveScoresResult = {
  ok: true;
  season: string;
  week: number;
  seasonType: ScoreSyncSeasonType;
  eventsConsidered: number;
  athleteLines: number;
  defLines: number;
  upserted: number;
  matchedPlayers: number;
  unmappedAthletes: number;
  maxUpdatedAt: string | null;
  durationMs: number;
  skipped?: boolean;
  reason?: string;
};

/** Load ESPN athlete id → internal player id map. */
export async function loadEspnPlayerIdMap(
  executor: ScoresDb = db,
): Promise<Map<string, string>> {
  const externalIds = await executor
    .select({
      externalId: playerExternalIds.externalId,
      playerId: playerExternalIds.playerId,
    })
    .from(playerExternalIds)
    .where(eq(playerExternalIds.provider, "espn"));

  return new Map(
    externalIds.map((row) => [row.externalId, row.playerId]),
  );
}

/** Load NFL team abbrev → internal team DEF player id. */
export async function loadDefPlayerIdByNflTeam(
  executor: ScoresDb = db,
): Promise<Map<string, string>> {
  const rows = await executor
    .select({
      id: players.id,
      nflTeam: players.nflTeam,
    })
    .from(players)
    .where(eq(players.primaryPositionId, "DEF"));

  const map = new Map<string, string>();
  for (const row of rows) {
    const abbrev = normalizeNflTeamAbbrev(row.nflTeam);
    if (!abbrev) {
      continue;
    }
    map.set(abbrev, row.id);
  }
  return map;
}

async function maxUpdatedAtForWeek(input: {
  season: string;
  week: number;
  seasonType: ScoreSyncSeasonType;
}): Promise<Date | null> {
  const [row] = await db
    .select({ value: max(playerScores.updatedAt) })
    .from(playerScores)
    .where(
      and(
        eq(playerScores.season, input.season),
        eq(playerScores.week, input.week),
        eq(playerScores.seasonType, input.seasonType),
        eq(playerScores.kind, "stats"),
      ),
    );

  return row?.value ?? null;
}

/**
 * Upsert ESPN boxscore lines into `player_scores` (kind=stats).
 * Merges into existing stats JSON so Sleeper-only keys are preserved;
 * ESPN keys win on conflict.
 */
async function upsertPlayerStatLines(input: {
  executor?: ScoresDb;
  season: string;
  week: number;
  seasonType?: ScoreSyncSeasonType;
  lines: Array<{ playerId: string; stats: Record<string, number> }>;
}): Promise<number> {
  const executor = input.executor ?? db;
  const seasonType = input.seasonType ?? "regular";
  const values: Array<{
    playerId: string;
    season: string;
    week: number;
    seasonType: ScoreSyncSeasonType;
    kind: "stats";
    stats: Record<string, number>;
    gp: number;
  }> = [];

  for (const line of input.lines) {
    if (Object.keys(line.stats).length === 0) {
      continue;
    }
    values.push({
      playerId: line.playerId,
      season: input.season,
      week: input.week,
      seasonType,
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
          // Right-hand keys win; preserves Sleeper-only keys ESPN doesn't send.
          stats: sql`coalesce(${playerScores.stats}, '{}'::jsonb) || excluded.stats`,
          gp: sql`greatest(coalesce(${playerScores.gp}, 0), excluded.gp)`,
          updatedAt: new Date(),
        },
      });
  }

  return values.length;
}

/**
 * Upsert ESPN boxscore lines into `player_scores` (kind=stats).
 * Merges into existing stats JSON so Sleeper-only keys are preserved;
 * ESPN keys win on conflict.
 */
export async function upsertEspnStatLines(input: {
  executor?: ScoresDb;
  espnIdToPlayerId: Map<string, string>;
  season: string;
  week: number;
  seasonType?: ScoreSyncSeasonType;
  lines: Array<{ espnAthleteId: string; stats: Record<string, number> }>;
}): Promise<{ upserted: number; unmapped: number }> {
  const mapped: Array<{ playerId: string; stats: Record<string, number> }> = [];
  let unmapped = 0;

  for (const line of input.lines) {
    const playerId = input.espnIdToPlayerId.get(line.espnAthleteId);
    if (!playerId) {
      unmapped++;
      continue;
    }
    mapped.push({ playerId, stats: line.stats });
  }

  const upserted = await upsertPlayerStatLines({
    executor: input.executor,
    season: input.season,
    week: input.week,
    seasonType: input.seasonType,
    lines: mapped,
  });

  return { upserted, unmapped };
}

/**
 * Pull ESPN athlete boxscores for in-progress / finished games in a week
 * and merge into `player_scores`.
 */
export async function syncEspnLiveScores(options?: {
  week?: number;
  season?: string;
  seasonType?: ScoreSyncSeasonType;
  /** Include finished games (default true). */
  includePost?: boolean;
  /** Only sync these event ids (skip scoreboard filter). */
  eventIds?: string[];
}): Promise<SyncEspnLiveScoresResult> {
  const started = Date.now();
  const state = await getNflState({ fresh: true });
  const includePost = options?.includePost ?? true;

  const hasWeekOverride = options?.week != null;
  const hasSeasonOverride =
    options?.season != null && options.season.trim() !== "";

  let season = hasSeasonOverride ? options.season!.trim() : state.season;
  const week = hasWeekOverride
    ? options.week!
    : (state.display_week ?? state.week);
  const seasonType: ScoreSyncSeasonType =
    options?.seasonType ??
    (state.season_type === "pre" || state.season_type === "post"
      ? state.season_type
      : "regular");

  const sleeperOffseason =
    !hasWeekOverride &&
    (state.season_type === "off" ||
      !Number.isFinite(week) ||
      week < 1);

  if (sleeperOffseason && !options?.eventIds?.length) {
    return {
      ok: true,
      skipped: true,
      reason:
        "Sleeper is in offseason (week 0). Pass ?season=YYYY&week=N to sync a prior week.",
      season: state.season,
      week: 0,
      seasonType,
      eventsConsidered: 0,
      athleteLines: 0,
      defLines: 0,
      upserted: 0,
      matchedPlayers: 0,
      unmappedAthletes: 0,
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
    throw new Error(`Invalid fantasy week for ESPN score sync: ${week}`);
  }

  const seasonYear = Number.parseInt(season, 10);
  if (!Number.isFinite(seasonYear)) {
    throw new Error(`Invalid season for ESPN score sync: ${season}`);
  }

  const espnSeasonType = espnSeasonTypeForNfl(seasonType);

  let eventIds = options?.eventIds?.filter(Boolean) ?? [];
  if (eventIds.length === 0) {
    const board = await getNflScoreboard({
      season: seasonYear,
      week,
      seasonType: espnSeasonType,
      calendarSeasonTypes: [espnSeasonType],
    });
    eventIds = board.games
      .filter(
        (game) =>
          game.status === "in" || (includePost && game.status === "post"),
      )
      .map((game) => game.id);
  }

  if (eventIds.length === 0) {
    return {
      ok: true,
      skipped: true,
      reason: "No in-progress or finished ESPN games for this week.",
      season,
      week,
      seasonType,
      eventsConsidered: 0,
      athleteLines: 0,
      defLines: 0,
      upserted: 0,
      matchedPlayers: 0,
      unmappedAthletes: 0,
      maxUpdatedAt: null,
      durationMs: Date.now() - started,
    };
  }

  const [espnIdToPlayerId, defPlayerIdByTeam] = await Promise.all([
    loadEspnPlayerIdMap(),
    loadDefPlayerIdByNflTeam(),
  ]);
  if (espnIdToPlayerId.size === 0 && defPlayerIdByTeam.size === 0) {
    return {
      ok: true,
      skipped: true,
      reason:
        "No ESPN player id mappings or team DEF players yet. Re-run the Sleeper players seed.",
      season,
      week,
      seasonType,
      eventsConsidered: eventIds.length,
      athleteLines: 0,
      defLines: 0,
      upserted: 0,
      matchedPlayers: 0,
      unmappedAthletes: 0,
      maxUpdatedAt: null,
      durationMs: Date.now() - started,
    };
  }

  const athleteLines: Array<{
    espnAthleteId: string;
    stats: Record<string, number>;
  }> = [];
  const defStatLines: Array<{
    playerId: string;
    stats: Record<string, number>;
  }> = [];
  for (const eventId of eventIds) {
    const payload = await fetchEspnSummaryPayload(eventId);
    for (const line of parseEspnPlayerBoxscore(payload)) {
      athleteLines.push({
        espnAthleteId: line.espnAthleteId,
        stats: line.stats,
      });
    }
    for (const line of parseEspnTeamDefBoxscore(payload)) {
      const playerId = defPlayerIdByTeam.get(line.teamAbbreviation);
      if (!playerId) {
        continue;
      }
      defStatLines.push({ playerId, stats: line.stats });
    }
  }

  const { upserted: athleteUpserted, unmapped } = await upsertEspnStatLines({
    espnIdToPlayerId,
    season,
    week,
    seasonType,
    lines: athleteLines,
  });
  const defUpserted = await upsertPlayerStatLines({
    season,
    week,
    seasonType,
    lines: defStatLines,
  });
  const upserted = athleteUpserted + defUpserted;

  if (upserted > 0) {
    clearScoreRowsCache();
  }

  const maxUpdated = await maxUpdatedAtForWeek({ season, week, seasonType });

  return {
    ok: true,
    season,
    week,
    seasonType,
    eventsConsidered: eventIds.length,
    athleteLines: athleteLines.length,
    defLines: defStatLines.length,
    upserted,
    matchedPlayers: espnIdToPlayerId.size,
    unmappedAthletes: unmapped,
    maxUpdatedAt: maxUpdated?.toISOString() ?? null,
    durationMs: Date.now() - started,
  };
}
