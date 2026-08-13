import "server-only";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { leagues, leagueSeasons } from "@/db/schema";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import {
  completeExpiredTrade,
  expireTradeOffer,
} from "@/lib/leagues/trades/lifecycle";
import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import {
  getExpiredPendingTrades,
  getExpiredReviewTrades,
} from "@/lib/queries/trades";

function revalidateTradePaths(slug: string) {
  revalidatePath(`/league/${slug}/trades`);
  revalidatePath(`/league/${slug}/trades/new`);
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/activity`);
}

async function loadSeasonsByIds(seasonIds: string[]) {
  if (seasonIds.length === 0) {
    return new Map<
      string,
      {
        id: string;
        waiversEnabled: boolean;
        settings: LeagueSeasonSettings | null;
        benchSlots: number;
        slug: string;
        publicId: string;
        name: string;
      }
    >();
  }

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

  return new Map(seasons.map((season) => [season.id, season]));
}

/** Cron-only: expire pending offers + complete review-window trades. */
export async function processAllReadyTrades(_now?: Date) {
  void _now;
  const [reviewDue, offerDue] = await Promise.all([
    getExpiredReviewTrades(),
    getExpiredPendingTrades(),
  ]);

  if (reviewDue.length === 0 && offerDue.length === 0) {
    return {
      checked: 0,
      processed: 0,
      expiredOffers: 0,
      results: [] as Array<{ tradeId: string; slug: string }>,
    };
  }

  const seasonById = await loadSeasonsByIds([
    ...new Set([
      ...reviewDue.map((row) => row.leagueSeasonId),
      ...offerDue.map((row) => row.leagueSeasonId),
    ]),
  ]);

  const results: Array<{ tradeId: string; slug: string }> = [];
  let expiredOffers = 0;

  for (const row of offerDue) {
    const season = seasonById.get(row.leagueSeasonId);
    if (!season) {
      continue;
    }
    const result = await expireTradeOffer({
      tradeId: row.id,
      league: {
        leagueSeasonId: season.id,
        leaguePublicId: season.publicId,
        leagueName: season.name,
      },
    });
    if (result.ok) {
      expiredOffers += 1;
      results.push({ tradeId: row.id, slug: season.publicId });
      revalidateTradePaths(season.publicId);
    }
  }

  for (const row of reviewDue) {
    const season = seasonById.get(row.leagueSeasonId);
    if (!season) {
      continue;
    }

    const wire = resolveWaiverWireSettings(
      (season.settings as LeagueSeasonSettings | null)?.waiverWire,
    );
    const rules = resolveTransactionRules(
      (season.settings as LeagueSeasonSettings | null)?.transactionRules,
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
      enforceRosterMinimums: rules.enforceRosterMinimums,
    });
    if (result.ok) {
      results.push({ tradeId: row.id, slug: season.publicId });
      revalidateTradePaths(season.publicId);
    }
  }

  return {
    checked: reviewDue.length + offerDue.length,
    processed: results.length,
    expiredOffers,
    results,
  };
}
