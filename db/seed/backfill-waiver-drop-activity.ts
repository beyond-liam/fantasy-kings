import "./load-direct-env";

import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import { leagueActivity, players } from "@/db/schema";
import type { LeagueActivityMetadata } from "@/db/schema/league-activity";
import { db } from "@/lib/db";
import { formatWaiverAwardSummary } from "@/lib/leagues/waivers/activity";

/**
 * One-off: split bundled waiver_awarded "(dropped X)" into a separate
 * player_dropped row. Idempotent — skips awards that already have a matching drop.
 */
async function main() {
  const awards = await db
    .select({
      id: leagueActivity.id,
      leagueSeasonId: leagueActivity.leagueSeasonId,
      teamId: leagueActivity.teamId,
      actorUserId: leagueActivity.actorUserId,
      relatedPlayerId: leagueActivity.relatedPlayerId,
      claimId: leagueActivity.claimId,
      summary: leagueActivity.summary,
      metadata: leagueActivity.metadata,
      createdAt: leagueActivity.createdAt,
    })
    .from(leagueActivity)
    .where(
      and(
        eq(leagueActivity.type, "waiver_awarded"),
        or(
          isNotNull(leagueActivity.relatedPlayerId),
          sql`coalesce(${leagueActivity.metadata}->>'dropPlayerName', '') <> ''`,
          sql`${leagueActivity.summary} ~* '\\(dropped .+\\)'`,
        ),
      ),
    )
    .orderBy(leagueActivity.createdAt);

  console.log(`Found ${awards.length} bundled waiver awards.`);

  const relatedIds = [
    ...new Set(
      awards
        .map((row) => row.relatedPlayerId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const nameById = new Map<string, string>();
  if (relatedIds.length > 0) {
    const nameRows = await db
      .select({ id: players.id, fullName: players.fullName })
      .from(players)
      .where(inArray(players.id, relatedIds));
    for (const row of nameRows) {
      nameById.set(row.id, row.fullName);
    }
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const award of awards) {
    const meta = (award.metadata ?? {}) as LeagueActivityMetadata;
    const dropPlayerName =
      meta.dropPlayerName?.trim() ||
      (award.relatedPlayerId
        ? nameById.get(award.relatedPlayerId)?.trim()
        : null) ||
      award.summary.match(/\(dropped (.+?)\)\.?$/i)?.[1]?.trim() ||
      null;

    if (!dropPlayerName && !award.relatedPlayerId) {
      skipped += 1;
      continue;
    }

    let alreadySplit = false;
    if (award.claimId && award.relatedPlayerId) {
      const existing = await db
        .select({ id: leagueActivity.id })
        .from(leagueActivity)
        .where(
          and(
            eq(leagueActivity.type, "player_dropped"),
            eq(leagueActivity.claimId, award.claimId),
            eq(leagueActivity.playerId, award.relatedPlayerId),
          ),
        )
        .limit(1);
      alreadySplit = existing.length > 0;
    } else if (award.relatedPlayerId && award.teamId) {
      const existing = await db
        .select({ id: leagueActivity.id })
        .from(leagueActivity)
        .where(
          and(
            eq(leagueActivity.type, "player_dropped"),
            eq(leagueActivity.teamId, award.teamId),
            eq(leagueActivity.playerId, award.relatedPlayerId),
            sql`abs(extract(epoch from (${leagueActivity.createdAt} - ${award.createdAt}::timestamptz))) < 2`,
          ),
        )
        .limit(1);
      alreadySplit = existing.length > 0;
    }

    const teamName = meta.teamName?.trim() || "A team";
    const playerName = meta.playerName?.trim() || "a player";
    const cleanSummary = formatWaiverAwardSummary({
      teamName,
      playerName,
      bid: meta.bid,
      waiverType: meta.waiverType === "faab" ? "faab" : "priority",
    });
    const needsAwardCleanup =
      Boolean(meta.dropPlayerName) ||
      award.summary !== cleanSummary ||
      /\(dropped /i.test(award.summary);

    if (alreadySplit) {
      if (needsAwardCleanup) {
        await db
          .update(leagueActivity)
          .set({
            summary: cleanSummary,
            metadata: {
              ...meta,
              dropPlayerName: null,
            },
          })
          .where(eq(leagueActivity.id, award.id));
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    if (!dropPlayerName) {
      skipped += 1;
      continue;
    }

    await db.insert(leagueActivity).values({
      leagueSeasonId: award.leagueSeasonId,
      type: "player_dropped",
      teamId: award.teamId,
      actorUserId: award.actorUserId,
      playerId: award.relatedPlayerId,
      claimId: award.claimId,
      summary: `${teamName} dropped ${dropPlayerName}`,
      metadata: {
        teamName,
        playerName: dropPlayerName,
      },
      createdAt: new Date(award.createdAt.getTime() - 1),
    });
    inserted += 1;

    if (needsAwardCleanup) {
      await db
        .update(leagueActivity)
        .set({
          summary: cleanSummary,
          metadata: {
            ...meta,
            dropPlayerName: null,
          },
        })
        .where(eq(leagueActivity.id, award.id));
      updated += 1;
    }
  }

  console.log(
    `Inserted ${inserted} drop rows, cleaned ${updated} awards, skipped ${skipped}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
