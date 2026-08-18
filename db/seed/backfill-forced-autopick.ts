import "./load-direct-env";

import { eq, inArray } from "drizzle-orm";

import { drafts, leagueSeasons } from "@/db/schema";
import { db } from "@/lib/db";
import { ensureForcedAutopickStreakBackfill } from "@/lib/leagues/draft/backfill-forced-autopick";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";

/**
 * One-off: for live/paused drafts with "force Autopick after two missed picks"
 * on, replay each team's autopick streak from the board.
 */
async function main() {
  const rows = await db
    .select({
      draftId: drafts.id,
      leagueSeasonId: drafts.leagueSeasonId,
      settings: leagueSeasons.settings,
    })
    .from(drafts)
    .innerJoin(leagueSeasons, eq(drafts.leagueSeasonId, leagueSeasons.id))
    .where(inArray(drafts.status, ["live", "paused"]));

  console.log(`Found ${rows.length} live/paused drafts.`);

  let applied = 0;
  let skipped = 0;
  let forced = 0;

  for (const row of rows) {
    const draft = resolveDraftSettings(row.settings.draft);
    if (!draft.forceAutopickAfterTwoExpires) {
      skipped += 1;
      continue;
    }

    const result = await ensureForcedAutopickStreakBackfill({
      leagueSeasonId: row.leagueSeasonId,
      draftId: row.draftId,
      settings: row.settings,
    });

    if (!result) {
      skipped += 1;
      continue;
    }

    applied += 1;
    forced += result.forcedTeamIds.length;
    console.log(
      `${row.leagueSeasonId}: updated ${result.updated} team(s), forced ${result.forcedTeamIds.length}.`,
    );
  }

  console.log(
    `Done. Applied ${applied}, skipped ${skipped}, teams forced ${forced}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
