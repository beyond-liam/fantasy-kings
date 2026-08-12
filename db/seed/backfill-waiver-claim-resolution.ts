import "./load-direct-env";

import { and, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";

import { leagueActivity, teams, waiverClaims } from "@/db/schema";
import type { LeagueActivityMetadata } from "@/db/schema/league-activity";
import { db } from "@/lib/db";
import {
  buildClaimResolution,
  withClaimResolutionMetadata,
} from "@/lib/leagues/waivers/claim-resolution";

const PROCESS_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * One-off: attach claimResolution / claimCount to historical waiver_awarded
 * rows from processed waiver_claims. Idempotent when resolution already present.
 *
 * Note: priority order uses each team's *current* waiver priority (historical WP
 * at process time is not stored on claims).
 */
async function main() {
  const awards = await db
    .select({
      id: leagueActivity.id,
      leagueSeasonId: leagueActivity.leagueSeasonId,
      playerId: leagueActivity.playerId,
      claimId: leagueActivity.claimId,
      teamId: leagueActivity.teamId,
      metadata: leagueActivity.metadata,
      createdAt: leagueActivity.createdAt,
    })
    .from(leagueActivity)
    .where(eq(leagueActivity.type, "waiver_awarded"))
    .orderBy(leagueActivity.createdAt);

  console.log(`Found ${awards.length} waiver awards.`);

  let updated = 0;
  let skipped = 0;
  let unresolved = 0;

  for (const award of awards) {
    const meta = (award.metadata ?? {}) as LeagueActivityMetadata;
    if ((meta.claimResolution?.length ?? 0) > 0) {
      skipped += 1;
      continue;
    }
    if (!award.playerId || !award.leagueSeasonId) {
      unresolved += 1;
      continue;
    }

    const waiverType = meta.waiverType === "faab" ? "faab" : "priority";

    const [awardClaim] = award.claimId
      ? await db
          .select({ processedAt: waiverClaims.processedAt })
          .from(waiverClaims)
          .where(eq(waiverClaims.id, award.claimId))
          .limit(1)
      : [null];

    const anchor =
      awardClaim?.processedAt?.getTime() ?? award.createdAt.getTime();
    const windowStart = new Date(anchor - PROCESS_WINDOW_MS);
    const windowEnd = new Date(anchor + PROCESS_WINDOW_MS);

    const rivalRows = await db
      .select({
        id: waiverClaims.id,
        teamId: waiverClaims.teamId,
        bid: waiverClaims.bid,
        status: waiverClaims.status,
        failReason: waiverClaims.failReason,
        createdAt: waiverClaims.createdAt,
        teamName: teams.name,
        waiverPriority: teams.waiverPriority,
      })
      .from(waiverClaims)
      .innerJoin(teams, eq(waiverClaims.teamId, teams.id))
      .where(
        and(
          eq(waiverClaims.leagueSeasonId, award.leagueSeasonId),
          eq(waiverClaims.playerId, award.playerId),
          inArray(waiverClaims.status, ["awarded", "failed"]),
          isNotNull(waiverClaims.processedAt),
          gte(waiverClaims.processedAt, windowStart),
          lte(waiverClaims.processedAt, windowEnd),
        ),
      );

    if (rivalRows.length > 0) {
      const resolution = buildClaimResolution({
        waiverType,
        teamNameById: new Map(
          rivalRows.map((row) => [row.teamId, row.teamName]),
        ),
        claims: rivalRows.map((row) => ({
          id: row.id,
          teamId: row.teamId,
          bid: row.bid,
          waiverPriority: row.waiverPriority,
          createdAt: row.createdAt,
        })),
        statusByClaimId: new Map(
          rivalRows.map((row) => [
            row.id,
            {
              status: row.status as "awarded" | "failed",
              failReason: row.failReason,
            },
          ]),
        ),
      });

      await db
        .update(leagueActivity)
        .set({
          metadata: withClaimResolutionMetadata(
            { ...meta, waiverType },
            resolution,
          ),
        })
        .where(eq(leagueActivity.id, award.id));
      updated += 1;
      continue;
    }

    // Solo award with no rival claim rows — reconstruct winner only.
    if (!award.teamId) {
      unresolved += 1;
      continue;
    }

    const [team] = await db
      .select({
        id: teams.id,
        name: teams.name,
        waiverPriority: teams.waiverPriority,
      })
      .from(teams)
      .where(eq(teams.id, award.teamId))
      .limit(1);

    if (!team) {
      unresolved += 1;
      continue;
    }

    await db
      .update(leagueActivity)
      .set({
        metadata: withClaimResolutionMetadata(
          { ...meta, waiverType },
          [
            {
              teamId: team.id,
              teamName: team.name,
              bid: meta.bid ?? null,
              waiverPriority: team.waiverPriority,
              status: "won",
              failReason: null,
            },
          ],
        ),
      })
      .where(eq(leagueActivity.id, award.id));
    updated += 1;
  }

  console.log(
    `Updated ${updated}, skipped ${skipped} already filled, unresolved ${unresolved}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
