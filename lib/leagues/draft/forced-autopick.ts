import "server-only";

import { and, eq } from "drizzle-orm";

import { drafts, leagueSeasons, teams } from "@/db/schema";
import { db } from "@/lib/db";
import {
  buildDraftSchedule,
  getDraftRounds,
} from "@/lib/leagues/draft/board";
import { resolveTurnExpiresAt } from "@/lib/leagues/draft/clock";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";

/**
 * Owner came back online: turn off forced Autopick and restore a pick clock
 * if they are currently on the clock.
 */
export async function releaseForcedAutopickForUser(
  userId: string,
): Promise<void> {
  const forcedTeams = await db
    .select({
      id: teams.id,
      leagueSeasonId: teams.leagueSeasonId,
    })
    .from(teams)
    .where(and(eq(teams.userId, userId), eq(teams.forcedAutoPick, true)));

  if (forcedTeams.length === 0) {
    return;
  }

  for (const team of forcedTeams) {
    await db.transaction(async (tx) => {
      const [season] = await tx
        .select({
          settings: leagueSeasons.settings,
          benchSlots: leagueSeasons.benchSlots,
          pickTimeLimitSeconds: leagueSeasons.pickTimeLimitSeconds,
        })
        .from(leagueSeasons)
        .where(eq(leagueSeasons.id, team.leagueSeasonId))
        .limit(1);

      const [draft] = await tx
        .select({
          id: drafts.id,
          status: drafts.status,
          currentPickIndex: drafts.currentPickIndex,
        })
        .from(drafts)
        .where(eq(drafts.leagueSeasonId, team.leagueSeasonId))
        .limit(1);

      await tx
        .update(teams)
        .set({
          forcedAutoPick: false,
          autoPickEnabled: false,
          consecutiveExpiredPicks: 0,
        })
        .where(eq(teams.id, team.id));

      if (
        !season ||
        !draft ||
        (draft.status !== "live" && draft.status !== "paused")
      ) {
        return;
      }

      const seasonTeams = await tx
        .select({
          id: teams.id,
          name: teams.name,
          draftSlot: teams.draftSlot,
        })
        .from(teams)
        .where(eq(teams.leagueSeasonId, team.leagueSeasonId));

      const teamsWithSlots = seasonTeams
        .filter((row) => row.draftSlot != null)
        .map((row) => ({
          id: row.id,
          name: row.name,
          draftSlot: row.draftSlot as number,
        }));

      const schedule = buildDraftSchedule({
        teams: teamsWithSlots,
        rounds: getDraftRounds(season.settings.rosterSlots, season.benchSlots),
        style: resolveDraftSettings(season.settings.draft).style,
      });
      const onClock = schedule[draft.currentPickIndex];
      if (!onClock || onClock.teamId !== team.id) {
        return;
      }

      const now = new Date();
      if (draft.status === "live") {
        await tx
          .update(drafts)
          .set({
            turnExpiresAt: resolveTurnExpiresAt({
              now,
              pickTimeLimitSeconds: season.pickTimeLimitSeconds,
              clockExempt: false,
            }),
            pausedSecondsRemaining: null,
          })
          .where(eq(drafts.id, draft.id));
        return;
      }

      await tx
        .update(drafts)
        .set({
          pausedSecondsRemaining:
            season.pickTimeLimitSeconds > 0
              ? season.pickTimeLimitSeconds
              : null,
          turnExpiresAt: null,
        })
        .where(eq(drafts.id, draft.id));
    });
  }
}
