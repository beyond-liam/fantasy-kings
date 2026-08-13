import "./load-direct-env";

import { and, eq, gte, inArray, isNotNull, lte, or } from "drizzle-orm";

import {
  leagueActivity,
  players,
  rosterPlayers,
  teams,
} from "@/db/schema";
import type { LeagueActivityMetadata } from "@/db/schema/league-activity";
import { db } from "@/lib/db";
import { reservePlacementFromAcquisition } from "@/lib/leagues/activity-log";

/**
 * One-off: add missing ir_added / taxi_added rows when a player was
 * acquired (FA add or waiver award) directly onto IR/Taxi.
 *
 * Idempotent — skips when a matching reserve activity already exists for
 * that team + player + season + slot type.
 *
 * Usage:
 *   pnpm db:backfill:reserve-acquisition-activity
 *   pnpm db:backfill:reserve-acquisition-activity -- --dry-run
 */

const APPLY = !process.argv.includes("--dry-run");
/** Match acquisition activity near roster acquiredAt. */
const ACQUIRE_WINDOW_MS = 5 * 60 * 1000;

async function main() {
  const reserveRows = await db
    .select({
      leagueSeasonId: rosterPlayers.leagueSeasonId,
      teamId: rosterPlayers.teamId,
      playerId: rosterPlayers.playerId,
      slotPositionId: rosterPlayers.slotPositionId,
      acquiredAt: rosterPlayers.acquiredAt,
      teamName: teams.name,
      playerName: players.fullName,
    })
    .from(rosterPlayers)
    .innerJoin(teams, eq(rosterPlayers.teamId, teams.id))
    .innerJoin(players, eq(rosterPlayers.playerId, players.id))
    .where(
      and(
        eq(rosterPlayers.status, "rostered"),
        or(
          eq(rosterPlayers.slotPositionId, "IR"),
          eq(rosterPlayers.slotPositionId, "TAXI"),
        ),
        isNotNull(rosterPlayers.acquiredAt),
      ),
    );

  console.log(
    `Found ${reserveRows.length} rostered IR/Taxi players${APPLY ? "" : " (dry-run)"}.`,
  );

  let inserted = 0;
  let skipped = 0;

  for (const row of reserveRows) {
    const slot = row.slotPositionId;
    if (slot !== "IR" && slot !== "TAXI") {
      skipped += 1;
      continue;
    }
    if (!row.acquiredAt) {
      skipped += 1;
      continue;
    }

    const reserveType = slot === "IR" ? "ir_added" : "taxi_added";

    const [existingReserve] = await db
      .select({ id: leagueActivity.id })
      .from(leagueActivity)
      .where(
        and(
          eq(leagueActivity.leagueSeasonId, row.leagueSeasonId),
          eq(leagueActivity.teamId, row.teamId),
          eq(leagueActivity.playerId, row.playerId),
          eq(leagueActivity.type, reserveType),
        ),
      )
      .limit(1);

    if (existingReserve) {
      skipped += 1;
      continue;
    }

    const acquireStart = new Date(
      row.acquiredAt.getTime() - ACQUIRE_WINDOW_MS,
    );
    const acquireEnd = new Date(
      row.acquiredAt.getTime() + ACQUIRE_WINDOW_MS,
    );

    const acquisitions = await db
      .select({
        id: leagueActivity.id,
        type: leagueActivity.type,
        actorUserId: leagueActivity.actorUserId,
        claimId: leagueActivity.claimId,
        summary: leagueActivity.summary,
        metadata: leagueActivity.metadata,
        createdAt: leagueActivity.createdAt,
      })
      .from(leagueActivity)
      .where(
        and(
          eq(leagueActivity.leagueSeasonId, row.leagueSeasonId),
          eq(leagueActivity.teamId, row.teamId),
          eq(leagueActivity.playerId, row.playerId),
          inArray(leagueActivity.type, ["player_added", "waiver_awarded"]),
          gte(leagueActivity.createdAt, acquireStart),
          lte(leagueActivity.createdAt, acquireEnd),
        ),
      )
      .orderBy(leagueActivity.createdAt)
      .limit(5);

    if (acquisitions.length === 0) {
      skipped += 1;
      continue;
    }

    // Prefer the acquisition closest to acquiredAt.
    const acquisition = acquisitions.toSorted(
      (a, b) =>
        Math.abs(a.createdAt.getTime() - row.acquiredAt!.getTime()) -
        Math.abs(b.createdAt.getTime() - row.acquiredAt!.getTime()),
    )[0]!;

    const meta = (acquisition.metadata ?? {}) as LeagueActivityMetadata;
    const teamName = meta.teamName?.trim() || row.teamName;
    const playerName = meta.playerName?.trim() || row.playerName;
    const event = reservePlacementFromAcquisition({
      slotPositionId: slot,
      teamName,
      playerName,
    });
    if (!event) {
      skipped += 1;
      continue;
    }

    const createdAt = acquisition.createdAt;

    console.log(
      `${APPLY ? "Insert" : "Would insert"} ${event.type}: ${event.summary} (${acquisition.type} ${acquisition.id})`,
    );

    if (APPLY) {
      await db.insert(leagueActivity).values({
        leagueSeasonId: row.leagueSeasonId,
        type: event.type,
        teamId: row.teamId,
        actorUserId: acquisition.actorUserId,
        playerId: row.playerId,
        claimId: acquisition.claimId,
        summary: event.summary,
        metadata: {
          playerName,
          teamName,
        },
        createdAt,
      });
    }

    inserted += 1;
  }

  console.log(
    `Done. ${APPLY ? "Inserted" : "Would insert"} ${inserted}, skipped ${skipped}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
