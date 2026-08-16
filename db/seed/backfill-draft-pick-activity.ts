import "./load-direct-env";

import { and, eq, sql } from "drizzle-orm";

import {
  draftPicks,
  drafts,
  leagueActivity,
  players,
  teams,
} from "@/db/schema";
import { db } from "@/lib/db";

/**
 * One-off: mirror existing draft_picks into league_activity as draft_pick rows.
 * Idempotent — skips picks that already have a matching activity entry.
 */
async function main() {
  const picks = await db
    .select({
      leagueSeasonId: drafts.leagueSeasonId,
      teamId: draftPicks.teamId,
      playerId: draftPicks.playerId,
      overall: draftPicks.overall,
      round: draftPicks.round,
      pickInRound: draftPicks.pickInRound,
      source: draftPicks.source,
      madeAt: draftPicks.madeAt,
      madeByUserId: draftPicks.madeByUserId,
      teamName: teams.name,
      playerFullName: players.fullName,
    })
    .from(draftPicks)
    .innerJoin(drafts, eq(draftPicks.draftId, drafts.id))
    .innerJoin(teams, eq(draftPicks.teamId, teams.id))
    .innerJoin(players, eq(draftPicks.playerId, players.id))
    .orderBy(draftPicks.madeAt);

  console.log(`Found ${picks.length} draft picks.`);

  let inserted = 0;
  let skipped = 0;

  for (const pick of picks) {
    const existing = await db
      .select({ id: leagueActivity.id })
      .from(leagueActivity)
      .where(
        and(
          eq(leagueActivity.leagueSeasonId, pick.leagueSeasonId),
          eq(leagueActivity.type, "draft_pick"),
          eq(leagueActivity.teamId, pick.teamId),
          eq(leagueActivity.playerId, pick.playerId),
          sql`(${leagueActivity.metadata}->>'overall')::int = ${pick.overall}`,
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    await db.insert(leagueActivity).values({
      leagueSeasonId: pick.leagueSeasonId,
      type: "draft_pick",
      teamId: pick.teamId,
      actorUserId: pick.madeByUserId,
      playerId: pick.playerId,
      summary: `${pick.teamName} drafted ${pick.playerFullName} · Pick #${pick.overall}`,
      metadata: {
        playerName: pick.playerFullName,
        teamName: pick.teamName,
        overall: pick.overall,
        round: pick.round,
        pickInRound: pick.pickInRound,
        draftSource: pick.source,
      },
      createdAt: pick.madeAt,
    });
    inserted += 1;
  }

  console.log(`Inserted ${inserted}, skipped ${skipped} existing.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
