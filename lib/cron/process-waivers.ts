import "server-only";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { leagues, leagueSeasons } from "@/db/schema";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import { isWaiverProcessDue } from "@/lib/leagues/waivers/calendar";
import { processSeasonWaivers } from "@/lib/leagues/waivers/process";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";

function revalidateWaiverPaths(slug: string) {
  revalidatePath(`/league/${slug}`);
  revalidatePath(`/league/${slug}/players`);
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/activity`);
  revalidatePath(`/league/${slug}/settings/waivers`);
}

/** Cron-only: process every season inside its 10:00 UTC window window. */
export async function processAllDueWaivers(now: Date = new Date()): Promise<{
  checked: number;
  processed: number;
  results: Array<{
    seasonId: string;
    slug: string;
    awarded: number;
    failed: number;
  }>;
}> {
  const seasons = await db
    .select({
      id: leagueSeasons.id,
      leagueId: leagueSeasons.leagueId,
      waiversEnabled: leagueSeasons.waiversEnabled,
      waiverType: leagueSeasons.waiverType,
      faabBudget: leagueSeasons.faabBudget,
      benchSlots: leagueSeasons.benchSlots,
      irEnabled: leagueSeasons.irEnabled,
      taxiEnabled: leagueSeasons.taxiEnabled,
      settings: leagueSeasons.settings,
      lastWaiverProcessedAt: leagueSeasons.lastWaiverProcessedAt,
      slug: leagues.slug,
      publicId: leagues.publicId,
    })
    .from(leagueSeasons)
    .innerJoin(leagues, eq(leagueSeasons.leagueId, leagues.id))
    .where(eq(leagueSeasons.waiversEnabled, true));

  const results: Array<{
    seasonId: string;
    slug: string;
    awarded: number;
    failed: number;
  }> = [];

  for (const season of seasons) {
    const wire = resolveWaiverWireSettings(
      (season.settings as LeagueSeasonSettings | null)?.waiverWire,
    );
    if (
      !isWaiverProcessDue({
        processDays: wire.processDays,
        lastWaiverProcessedAt: season.lastWaiverProcessedAt,
        now,
      })
    ) {
      continue;
    }

    const result = await processSeasonWaivers({
      season: {
        ...season,
        settings: season.settings as LeagueSeasonSettings,
      },
      leagueSlug: season.publicId,
      now,
    });
    revalidateWaiverPaths(season.publicId);
    results.push({
      seasonId: season.id,
      slug: season.publicId,
      awarded: result.awarded,
      failed: result.failed,
    });
  }

  return {
    checked: seasons.length,
    processed: results.length,
    results,
  };
}
