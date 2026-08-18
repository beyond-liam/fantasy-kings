import "server-only";

import { and, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  leagueActivity,
  leagueSeasons,
  leagues,
  waiverClaims,
} from "@/db/schema";
import type { DynastySettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import {
  areKeepersLocked,
  isKeeperDeadlineDue,
  resolveDynastySettings,
  withKeepersLocked,
} from "@/lib/leagues/dynasty-settings";
import {
  keepersClearedSummary,
  type ClearanceSource,
} from "@/lib/leagues/keepers/clearance";
import { waiveOrDeleteRosterRow } from "@/lib/leagues/roster-writes";
import { getLeagueBySlug, getLeagueSeason } from "@/lib/queries/leagues";
import { listRosteredKeeperRows } from "@/lib/queries/keepers";

export type ClearNonKeepersResult =
  | {
      ok: true;
      clearedCount: number;
      alreadyLocked: boolean;
      skipped: boolean;
      dynasty: DynastySettings;
    }
  | { ok: false; error: string };

function revalidateKeeperPaths(slug: string) {
  revalidatePath(`/league/${slug}`);
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/activity`);
  revalidatePath(`/league/${slug}/settings`);
  revalidatePath(`/league/${slug}/settings/keepers`);
  revalidatePath(`/league/${slug}/players`);
}

export async function clearNonKeepersForSeason(input: {
  leagueSeasonId: string;
  leaguePublicId: string;
  source: ClearanceSource;
  actorUserId?: string | null;
  now?: Date;
}): Promise<ClearNonKeepersResult> {
  const now = input.now ?? new Date();

  const result = await db.transaction(async (tx): Promise<ClearNonKeepersResult> => {
    const [season] = await tx
      .select()
      .from(leagueSeasons)
      .where(eq(leagueSeasons.id, input.leagueSeasonId))
      .for("update")
      .limit(1);

    if (!season) {
      return { ok: false, error: "League season not found." };
    }
    if (season.leagueType !== "dynasty") {
      return {
        ok: false,
        error: "Clearing non-keepers is only available in dynasty leagues.",
      };
    }

    const dynasty = resolveDynastySettings(season.settings.dynasty);
    if (areKeepersLocked(dynasty)) {
      return {
        ok: true,
        clearedCount: 0,
        alreadyLocked: true,
        skipped: true,
        dynasty,
      };
    }

    if (input.source === "deadline" && !isKeeperDeadlineDue(dynasty, now)) {
      return {
        ok: true,
        clearedCount: 0,
        alreadyLocked: false,
        skipped: true,
        dynasty,
      };
    }

    if (dynasty.keepersMax == null) {
      if (input.source === "commissioner") {
        return {
          ok: false,
          error: "Set keepers max in Dynasty Rules before clearing non-keepers.",
        };
      }
      if (input.source === "deadline") {
        return {
          ok: true,
          clearedCount: 0,
          alreadyLocked: false,
          skipped: true,
          dynasty,
        };
      }
    }

    const rows = await listRosteredKeeperRows(season.id, tx);
    const toClear = rows.filter((row) => !row.isKeeper);
    const clearedCount = toClear.length;
    const locked = withKeepersLocked(dynasty, true);

    for (const row of toClear) {
      await waiveOrDeleteRosterRow({
        rowId: row.rosterRowId,
        waiversEnabled: season.waiversEnabled,
        dropWaiverHours: 0,
        skipWaivers: true,
        client: tx,
      });
    }

    const clearedPlayerIds = [...new Set(toClear.map((row) => row.playerId))];
    if (clearedPlayerIds.length > 0) {
      await tx
        .update(waiverClaims)
        .set({
          status: "cancelled",
          failReason: "Non-keepers cleared",
          updatedAt: now,
        })
        .where(
          and(
            eq(waiverClaims.leagueSeasonId, season.id),
            eq(waiverClaims.status, "pending"),
            or(
              inArray(waiverClaims.dropPlayerId, clearedPlayerIds),
              inArray(waiverClaims.playerId, clearedPlayerIds),
            ),
          ),
        );
    }

    if (toClear.length > 0) {
      await tx.insert(leagueActivity).values(
        toClear.map((row, index) => ({
          leagueSeasonId: season.id,
          type: "player_dropped" as const,
          teamId: row.teamId,
          actorUserId: input.actorUserId ?? null,
          playerId: row.playerId,
          summary: `${row.teamName} dropped ${row.playerName}`,
          metadata: {
            playerName: row.playerName,
            teamName: row.teamName,
          },
          createdAt: new Date(now.getTime() + index),
        })),
      );
    }

    await tx.insert(leagueActivity).values({
      leagueSeasonId: season.id,
      type: "keepers_cleared",
      actorUserId: input.actorUserId ?? null,
      summary: keepersClearedSummary(input.source, clearedCount),
      metadata: {
        clearedCount,
        clearanceSource: input.source,
      },
      createdAt: new Date(now.getTime() + toClear.length + 1),
    });

    await tx
      .update(leagueSeasons)
      .set({
        settings: {
          ...season.settings,
          dynasty: locked,
        },
      })
      .where(eq(leagueSeasons.id, season.id));

    return {
      ok: true,
      clearedCount,
      alreadyLocked: false,
      skipped: false,
      dynasty: locked,
    };
  });

  if (result.ok && !result.skipped) {
    revalidateKeeperPaths(input.leaguePublicId);
  }

  return result;
}

export async function processDueKeeperDeadline(
  slug: string,
  now: Date = new Date(),
): Promise<{
  processed: boolean;
  clearedCount: number;
  dynasty: DynastySettings | null;
}> {
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return { processed: false, clearedCount: 0, dynasty: null };
  }
  const season = await getLeagueSeason(league.id);
  if (!season || season.leagueType !== "dynasty") {
    return { processed: false, clearedCount: 0, dynasty: null };
  }

  const dynasty = resolveDynastySettings(season.settings.dynasty);
  if (!isKeeperDeadlineDue(dynasty, now)) {
    return { processed: false, clearedCount: 0, dynasty };
  }

  const result = await clearNonKeepersForSeason({
    leagueSeasonId: season.id,
    leaguePublicId: league.publicId,
    source: "deadline",
    now,
  });
  if (!result.ok) {
    return { processed: false, clearedCount: 0, dynasty };
  }
  return {
    processed: !result.skipped,
    clearedCount: result.clearedCount,
    dynasty: result.dynasty,
  };
}

export async function processAllDueKeeperDeadlines(now: Date = new Date()) {
  const seasons = await db
    .select({
      id: leagueSeasons.id,
      settings: leagueSeasons.settings,
      publicId: leagues.publicId,
    })
    .from(leagueSeasons)
    .innerJoin(leagues, eq(leagueSeasons.leagueId, leagues.id))
    .where(eq(leagueSeasons.leagueType, "dynasty"));

  const due = seasons.filter((season) =>
    isKeeperDeadlineDue(resolveDynastySettings(season.settings.dynasty), now),
  );

  const results: Array<{
    seasonId: string;
    slug: string;
    clearedCount: number;
  }> = [];

  for (const season of due) {
    const result = await clearNonKeepersForSeason({
      leagueSeasonId: season.id,
      leaguePublicId: season.publicId,
      source: "deadline",
      now,
    });
    if (result.ok && !result.skipped) {
      results.push({
        seasonId: season.id,
        slug: season.publicId,
        clearedCount: result.clearedCount,
      });
    }
  }

  return {
    checked: due.length,
    processed: results.length,
    results,
  };
}
