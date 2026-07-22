import "server-only";

import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

import { drafts, leagueSeasons, leagues } from "@/db/schema";
import { deliverAlert } from "@/lib/alerts/deliver";
import { getSeasonOwnerUserIds } from "@/lib/alerts/recipients";
import { db } from "@/lib/db";
import { draftRoomUrl } from "@/lib/email/env";
import {
  buildDraftSchedule,
  getDraftRounds,
} from "@/lib/leagues/draft/board";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";
import { getDraftBySeasonId, getSeasonDraftTeams } from "@/lib/queries/draft";

function teamUserIdMap(
  seasonTeams: Array<{ id: string; userId: string | null }>,
) {
  return new Map(seasonTeams.map((team) => [team.id, team.userId]));
}

/** Draft went live — league email + on-clock / on-deck. */
export async function announceDraftStarted(input: {
  seasonId: string;
  leaguePublicId: string;
  leagueName: string;
  resumed?: boolean;
}) {
  const draft = await getDraftBySeasonId(input.seasonId);
  if (!draft || draft.status !== "live") {
    return;
  }

  const seasonTeams = await getSeasonDraftTeams(input.seasonId);
  const href = draftRoomUrl(input.leaguePublicId);

  if (!input.resumed) {
    await deliverAlert({
      userIds: await getSeasonOwnerUserIds(input.seasonId),
      email: {
        subject: `${input.leagueName}: Draft has started`,
        title: "Draft has started",
        body: `The ${input.leagueName} draft is live. Open the draft room to pick when you're on the clock.`,
        ctaLabel: "Open draft room",
        ctaUrl: href,
        dedupeKeyForUser: (userId) => `draft:start:${draft.id}:${userId}`,
        tags: ["draft", "draft-start"],
      },
    });
  }

  await announceOnClockAndOnDeck({
    seasonId: input.seasonId,
    leaguePublicId: input.leaguePublicId,
    leagueName: input.leagueName,
    draftId: draft.id,
    currentPickIndex: draft.currentPickIndex,
    seasonTeams,
  });
}

/** After a successful pick — end emails, or next on-clock / on-deck. */
export async function announceDraftAfterPick(input: {
  seasonId: string;
  leaguePublicId: string;
  leagueName: string;
  draftId: string;
  nextPickIndex: number;
  scheduleLength: number;
  seasonTeams: Array<{
    id: string;
    name: string;
    draftSlot: number | null;
    userId: string | null;
  }>;
}) {
  const href = draftRoomUrl(input.leaguePublicId);

  if (input.nextPickIndex >= input.scheduleLength) {
    await deliverAlert({
      userIds: input.seasonTeams.map((team) => team.userId),
      email: {
        subject: `${input.leagueName}: Draft is complete`,
        title: "Draft is complete",
        body: `The ${input.leagueName} draft has finished. Your season is live — set your lineup and check matchups.`,
        ctaLabel: "Open draft room",
        ctaUrl: href,
        dedupeKeyForUser: (userId) =>
          `draft:end:${input.draftId}:${userId}`,
        tags: ["draft", "draft-end"],
      },
    });
    return;
  }

  await announceOnClockAndOnDeck({
    seasonId: input.seasonId,
    leaguePublicId: input.leaguePublicId,
    leagueName: input.leagueName,
    draftId: input.draftId,
    currentPickIndex: input.nextPickIndex,
    seasonTeams: input.seasonTeams,
  });
}

async function announceOnClockAndOnDeck(input: {
  seasonId: string;
  leaguePublicId: string;
  leagueName: string;
  draftId: string;
  currentPickIndex: number;
  seasonTeams: Array<{
    id: string;
    name: string;
    draftSlot: number | null;
    userId: string | null;
  }>;
}) {
  const [season] = await db
    .select({
      settings: leagueSeasons.settings,
      benchSlots: leagueSeasons.benchSlots,
    })
    .from(leagueSeasons)
    .where(eq(leagueSeasons.id, input.seasonId))
    .limit(1);

  if (!season) {
    return;
  }

  const draftSettings = resolveDraftSettings(season.settings.draft);
  const teamsWithSlots = input.seasonTeams
    .filter((team) => team.draftSlot != null)
    .map((team) => ({
      id: team.id,
      name: team.name,
      draftSlot: team.draftSlot as number,
    }));

  const rounds = getDraftRounds(season.settings.rosterSlots, season.benchSlots);
  const schedule = buildDraftSchedule({
    teams: teamsWithSlots,
    rounds,
    style: draftSettings.style,
  });

  const byTeam = teamUserIdMap(input.seasonTeams);
  const href = draftRoomUrl(input.leaguePublicId);
  const onClock = schedule[input.currentPickIndex];
  const onDeck = schedule[input.currentPickIndex + 1];

  if (onClock) {
    const userId = byTeam.get(onClock.teamId);
    if (userId) {
      await deliverAlert({
        userIds: [userId],
        email: {
          subject: `${input.leagueName}: You're on the clock`,
          title: "You're on the clock",
          body: `It's your turn to pick in ${input.leagueName} (pick ${onClock.overall}, round ${onClock.round}).`,
          ctaLabel: "Make your pick",
          ctaUrl: href,
          dedupeKeyForUser: () =>
            `draft:on_clock:${input.draftId}:${input.currentPickIndex}`,
          tags: ["draft", "draft-on-clock"],
        },
      });
    }
  }

  if (onDeck) {
    const userId = byTeam.get(onDeck.teamId);
    if (userId) {
      const onDeckIndex = input.currentPickIndex + 1;
      await deliverAlert({
        userIds: [userId],
        email: {
          subject: `${input.leagueName}: You're on deck`,
          title: "You're on deck",
          body: `You're up next in ${input.leagueName} (pick ${onDeck.overall}). Get ready.`,
          ctaLabel: "Open draft room",
          ctaUrl: href,
          dedupeKeyForUser: () =>
            `draft:on_deck:${input.draftId}:${onDeckIndex}`,
          tags: ["draft", "draft-on-deck"],
        },
      });
    }
  }
}

export type DraftReminderResult = {
  checked24h: number;
  sent24h: number;
  checked15m: number;
  sent15m: number;
};

/** Live drafts only — cron entry for T-24h / T-15m emails. */
export async function sendDueDraftReminders(
  now = new Date(),
): Promise<DraftReminderResult> {
  const result: DraftReminderResult = {
    checked24h: 0,
    sent24h: 0,
    checked15m: 0,
    sent15m: 0,
  };

  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const in20m = new Date(now.getTime() + 20 * 60 * 1000);
  const in10m = new Date(now.getTime() + 10 * 60 * 1000);

  const upcoming = await db
    .select({
      seasonId: leagueSeasons.id,
      draftStartAt: leagueSeasons.draftStartAt,
      leaguePublicId: leagues.publicId,
      leagueName: leagues.name,
    })
    .from(leagueSeasons)
    .innerJoin(leagues, eq(leagues.id, leagueSeasons.leagueId))
    .leftJoin(drafts, eq(drafts.leagueSeasonId, leagueSeasons.id))
    .where(
      and(
        eq(leagueSeasons.draftType, "live"),
        gt(leagueSeasons.draftStartAt, now),
        lte(leagueSeasons.draftStartAt, in25h),
        inArray(leagueSeasons.status, ["setup", "recruiting", "draft"]),
        or(isNull(drafts.id), eq(drafts.status, "scheduled")),
      ),
    );

  for (const row of upcoming) {
    const start = row.draftStartAt.getTime();
    const href = draftRoomUrl(row.leaguePublicId);
    const userIds = await getSeasonOwnerUserIds(row.seasonId);

    if (start >= in23h.getTime() && start <= in25h.getTime()) {
      result.checked24h += 1;
      const { emailed } = await deliverAlert({
        userIds,
        email: {
          subject: `${row.leagueName}: Draft is tomorrow`,
          title: "Draft is tomorrow",
          body: `Your ${row.leagueName} live draft starts around ${row.draftStartAt.toUTCString()}.`,
          ctaLabel: "Open draft room",
          ctaUrl: href,
          dedupeKeyForUser: (userId) =>
            `draft:remind:24h:${row.seasonId}:${userId}`,
          tags: ["draft", "draft-remind-24h"],
          sync: true,
        },
      });
      if (emailed > 0) {
        result.sent24h += 1;
      }
    }

    if (start >= in10m.getTime() && start <= in20m.getTime()) {
      result.checked15m += 1;
      const { emailed } = await deliverAlert({
        userIds,
        email: {
          subject: `${row.leagueName}: Draft starts in 15 minutes`,
          title: "Draft starts soon",
          body: `Your ${row.leagueName} live draft starts in about 15 minutes. Be ready in the draft room.`,
          ctaLabel: "Open draft room",
          ctaUrl: href,
          dedupeKeyForUser: (userId) =>
            `draft:remind:15m:${row.seasonId}:${userId}`,
          tags: ["draft", "draft-remind-15m"],
          sync: true,
        },
      });
      if (emailed > 0) {
        result.sent15m += 1;
      }
    }
  }

  return result;
}
