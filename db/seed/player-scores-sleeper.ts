import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";

import {
  loadSleeperPlayerIdMap,
  upsertSleeperScoresBatch,
} from "../../lib/scores/sync-sleeper-scores";
import { getNflState } from "../../lib/sleeper/api";
import { createSeedClient } from "./client";

dotenv.config({ path: ".env.local" });

const WEEKS = Array.from({ length: 18 }, (_, index) => index + 1);
const MAX_JOB_RETRIES = 5;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientDbError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const withCause = error as Error & {
    code?: string;
    cause?: { code?: string; message?: string };
  };
  const codes = [withCause.code, withCause.cause?.code].filter(Boolean);
  if (
    codes.some(
      (code) =>
        code === "ECONNRESET" ||
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT" ||
        code === "57P01" ||
        code === "08006",
    )
  ) {
    return true;
  }

  const message = `${error.message} ${withCause.cause?.message ?? ""}`.toLowerCase();
  return (
    message.includes("econnreset") ||
    message.includes("connection terminated") ||
    message.includes("connection closed") ||
    message.includes("server closed the connection")
  );
}

type SeedMode = "all" | "projections" | "stats";

function getSeedMode(): SeedMode {
  const mode = process.env.SEED_SCORES_MODE;
  if (mode === "projections" || mode === "stats") {
    return mode;
  }
  return "all";
}

function buildJobs(
  currentSeason: string,
  previousSeason: string,
  currentWeek: number,
  mode: SeedMode,
) {
  const projectionJobs = [
    {
      label: "projections season",
      kind: "projection" as const,
      season: currentSeason,
      week: null as number | null,
    },
    ...WEEKS.map((week) => ({
      label: `projections week ${week}`,
      kind: "projection" as const,
      season: currentSeason,
      week: week as number | null,
    })),
  ];

  const previousStatsJobs = [
    {
      label: "stats season (previous)",
      kind: "stats" as const,
      season: previousSeason,
      week: null as number | null,
    },
    ...WEEKS.map((week) => ({
      label: `stats week ${week} (previous)`,
      kind: "stats" as const,
      season: previousSeason,
      week: week as number | null,
    })),
  ];

  const weeksToSeed = Math.min(
    18,
    Math.max(0, Number.isFinite(currentWeek) ? currentWeek : 0),
  );
  const currentStatsJobs = [
    {
      label: "stats season (current)",
      kind: "stats" as const,
      season: currentSeason,
      week: null as number | null,
    },
    ...Array.from({ length: weeksToSeed }, (_, index) => index + 1).map(
      (week) => ({
        label: `stats week ${week} (current)`,
        kind: "stats" as const,
        season: currentSeason,
        week: week as number | null,
      }),
    ),
  ];

  const statsJobs = [...previousStatsJobs, ...currentStatsJobs];

  if (mode === "projections") {
    return projectionJobs;
  }

  if (mode === "stats") {
    return statsJobs;
  }

  return [...projectionJobs, ...statsJobs];
}

async function seedPlayerScores() {
  const state = await getNflState({ fresh: true });
  const currentSeason = state.season;
  const previousSeason = state.previous_season;

  let client = createSeedClient();
  let db = drizzle(client);

  async function reconnect() {
    try {
      await client.end({ timeout: 2 });
    } catch {
      // ignore close errors on a dead connection
    }
    client = createSeedClient();
    db = drizzle(client);
  }

  // Seed uses a dedicated postgres client; cast matches app `db` insert API.
  const sleeperIdToPlayerId = await loadSleeperPlayerIdMap(
    db as unknown as Parameters<typeof loadSleeperPlayerIdMap>[0],
  );

  console.log(`Seeding scores for ${sleeperIdToPlayerId.size} rostered players.`);

  const mode = getSeedMode();
  const jobs = buildJobs(
    currentSeason,
    previousSeason,
    state.display_week ?? state.week,
    mode,
  );
  console.log(`Mode: ${mode} (${jobs.length} batches)`);

  for (const job of jobs) {
    let attempt = 0;
    for (;;) {
      try {
        const result = await upsertSleeperScoresBatch(
          db as unknown as Parameters<typeof upsertSleeperScoresBatch>[0],
          sleeperIdToPlayerId,
          job.kind,
          job.season,
          job.week,
        );
        console.log(
          `  ${job.label} (${job.season}): ${result.upserted} rows (${result.sleeperRows} from Sleeper)`,
        );
        break;
      } catch (error) {
        attempt += 1;
        if (!isTransientDbError(error) || attempt > MAX_JOB_RETRIES) {
          throw error;
        }
        const delayMs = Math.min(8_000, 1_000 * 2 ** (attempt - 1));
        console.warn(
          `  ${job.label} failed (attempt ${attempt}/${MAX_JOB_RETRIES}), reconnecting in ${delayMs}ms…`,
        );
        await reconnect();
        await sleep(delayMs);
      }
    }
    await sleep(250);
  }

  await client.end();
  console.log("Player scores seed complete.");
}

seedPlayerScores().catch((error) => {
  console.error(error);
  process.exit(1);
});
