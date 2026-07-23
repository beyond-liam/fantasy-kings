import "server-only";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { leagues, leagueSeasons } from "@/db/schema";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import { completeExpiredTrade } from "@/lib/leagues/trades/lifecycle";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import { getExpiredReviewTrades } from "@/lib/queries/trades";

function revalidateTradePaths(slug: string) {
  revalidatePath(`/league/${slug}/trades`);
  revalidatePath(`/league/${slug}/trades/new`);
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/activity`);
}

/** Cron-only: complete review-window trades whose reviewEndsAt has passed. */
export async function processAllReadyTrades(_now: Date = new Date()) {
  const expired = await getExpiredReviewTrades();
  if (expired.length === 0) {
    return {
      checked: 0,
      processed: 0,
      results: [] as Array<{ tradeId: string; slug: string }>,
    };
  }

  const seasonIds = [...new Set(expired.map((row) => row.leagueSeasonId))];
  const seasons = await db
    .select({
      id: leagueSeasons.id,
      waiversEnabled: leagueSeasons.waiversEnabled,
      settings: leagueSeasons.settings,
      benchSlots: leagueSeasons.benchSlots,
      slug: leagues.slug,
      publicId: leagues.publicId,
      name: leagues.name,
    })
    .from(leagueSeasons)
    .innerJoin(leagues, eq(leagueSeasons.leagueId, leagues.id))
    .where(inArray(leagueSeasons.id, seasonIds));

  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const results: Array<{ tradeId: string; slug: string }> = [];

  for (const row of expired) {
    const season = seasonById.get(row.leagueSeasonId);
    if (!season) {
      continue;
    }

    const wire = resolveWaiverWireSettings(
      (season.settings as LeagueSeasonSettings | null)?.waiverWire,
    );
    const result = await completeExpiredTrade({
      tradeId: row.id,
      league: {
        leagueSeasonId: season.id,
        leaguePublicId: season.publicId,
        leagueName: season.name,
      },
      waiversEnabled: season.waiversEnabled,
      waiverWire: wire,
      rosterSlots: (season.settings as LeagueSeasonSettings | null)
        ?.rosterSlots,
      benchSlots: season.benchSlots,
    });
    if (result.ok) {
      results.push({ tradeId: row.id, slug: season.publicId });
      revalidateTradePaths(season.publicId);
    }
  }

  return {
    checked: expired.length,
    processed: results.length,
    results,
  };
}
