import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { drafts, leagueSeasons, leagues } from "@/db/schema";
import { db } from "@/lib/db";
import { activateDraftLive } from "@/lib/leagues/draft/activate";
import { getSeasonDraftTeams } from "@/lib/queries/draft";

export type AutoStartDraftsResult = {
  checked: number;
  started: number;
  skipped: number;
  errors: Array<{ seasonId: string; error: string }>;
};

/**
 * Start any drafts whose scheduled `draftStartAt` has passed and that are not
 * already live / paused / complete.
 */
export async function autoStartDueDrafts(
  now = new Date(),
): Promise<AutoStartDraftsResult> {
  const due = await db
    .select({
      seasonId: leagueSeasons.id,
      seasonStatus: leagueSeasons.status,
      pickTimeLimitSeconds: leagueSeasons.pickTimeLimitSeconds,
      leaguePublicId: leagues.publicId,
      leagueName: leagues.name,
      draftId: drafts.id,
      draftStatus: drafts.status,
    })
    .from(leagueSeasons)
    .innerJoin(leagues, eq(leagues.id, leagueSeasons.leagueId))
    .leftJoin(drafts, eq(drafts.leagueSeasonId, leagueSeasons.id))
    .where(
      and(
        lte(leagueSeasons.draftStartAt, now),
        inArray(leagueSeasons.status, ["setup", "recruiting", "draft"]),
        or(isNull(drafts.id), eq(drafts.status, "scheduled")),
      ),
    );

  const result: AutoStartDraftsResult = {
    checked: due.length,
    started: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of due) {
    const seasonTeams = await getSeasonDraftTeams(row.seasonId);
    const activated = await activateDraftLive({
      seasonId: row.seasonId,
      seasonStatus: row.seasonStatus,
      seasonTeams,
      pickTimeLimitSeconds: row.pickTimeLimitSeconds,
      allowResume: false,
    });

    if (!activated.ok) {
      if (
        activated.error === "Draft is already live." ||
        activated.error === "Draft is paused." ||
        activated.error === "Draft is already complete." ||
        activated.error === "Season is already active."
      ) {
        result.skipped += 1;
      } else {
        result.errors.push({
          seasonId: row.seasonId,
          error: activated.error,
        });
      }
      continue;
    }

    result.started += 1;
    revalidatePath(`/league/${row.leaguePublicId}/draft`);
    revalidatePath(`/league/${row.leaguePublicId}`);

    try {
      const { queueDraftStartedEmails } = await import("@/lib/email/draft");
      await queueDraftStartedEmails({
        seasonId: row.seasonId,
        leaguePublicId: row.leaguePublicId,
        leagueName: row.leagueName,
        resumed: false,
      });
    } catch (error) {
      console.error("[email] draft started queue failed", row.seasonId, error);
    }
  }

  return result;
}
