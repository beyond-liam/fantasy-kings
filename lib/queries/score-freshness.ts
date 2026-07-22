import { and, eq, max } from "drizzle-orm";

import { playerScores } from "@/db/schema";
import { db } from "@/lib/db";

/** Latest `player_scores.updated_at` for a season/week/kind (UI freshness). */
export async function getPlayerScoresFreshness(input: {
  season: string;
  week: number;
  kind?: "stats" | "projection";
}): Promise<Date | null> {
  const kind = input.kind ?? "stats";
  const [row] = await db
    .select({ value: max(playerScores.updatedAt) })
    .from(playerScores)
    .where(
      and(
        eq(playerScores.season, input.season),
        eq(playerScores.week, input.week),
        eq(playerScores.seasonType, "regular"),
        eq(playerScores.kind, kind),
      ),
    );

  return row?.value ?? null;
}
