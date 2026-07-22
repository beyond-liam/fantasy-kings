import "server-only";

import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

import { drafts, leagueSeasons, leagues, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { claimEmailSend } from "@/lib/email/dedupe";
import { draftRoomUrl } from "@/lib/email/env";
import { getEmailsForUserIds } from "@/lib/email/recipients";
import { buildSimpleEmail, queueEmailsToUsers } from "@/lib/email/send";
import {
  buildDraftSchedule,
  getDraftRounds,
} from "@/lib/leagues/draft/board";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";
import { getDraftBySeasonId, getSeasonDraftTeams } from "@/lib/queries/draft";

async function getLeagueOwnerUserIds(seasonId: string) {
  const rows = await db
    .select({ userId: teams.userId })
    .from(teams)
    .where(eq(teams.leagueSeasonId, seasonId));
  return rows.map((row) => row.userId);
}

function teamUserIdMap(
  seasonTeams: Array<{ id: string; userId: string | null }>,
) {
  return new Map(seasonTeams.map((team) => [team.id, team.userId]));
}

export async function queueDraftStartedEmails(input: {
  seasonId: string;
  leaguePublicId: string;
  leagueName: string;
  /** Skip "draft started" blast when resuming from pause. */
  resumed?: boolean;
}) {
  const draft = await getDraftBySeasonId(input.seasonId);
  if (!draft || draft.status !== "live") {
    return;
  }

  const seasonTeams = await getSeasonDraftTeams(input.seasonId);
  const href = draftRoomUrl(input.leaguePublicId);

  if (!input.resumed) {
    queueEmailsToUsers({
      userIds: await getLeagueOwnerUserIds(input.seasonId),
      dedupeKeyForUser: (userId) => `draft:start:${draft.id}:${userId}`,
      subject: `${input.leagueName}: Draft has started`,
      title: "Draft has started",
      body: `The ${input.leagueName} draft is live. Open the draft room to pick when you're on the clock.`,
      ctaLabel: "Open draft room",
      ctaUrl: href,
      tags: ["draft", "draft-start"],
    });
  }

  await queueOnClockAndOnDeckEmails({
    seasonId: input.seasonId,
    leaguePublicId: input.leaguePublicId,
    leagueName: input.leagueName,
    draftId: draft.id,
    currentPickIndex: draft.currentPickIndex,
    seasonTeams,
  });
}

export async function queueDraftAfterPickEmails(input: {
  seasonId: string;
  leaguePublicId: string;
  leagueName: string;
  draftId: string;
  /** Pick index after the successful pick (next on-clock index, or length if complete). */
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
    queueEmailsToUsers({
      userIds: input.seasonTeams.map((team) => team.userId),
      dedupeKeyForUser: (userId) => `draft:end:${input.draftId}:${userId}`,
      subject: `${input.leagueName}: Draft is complete`,
      title: "Draft is complete",
      body: `The ${input.leagueName} draft has finished. Your season is live — set your lineup and check matchups.`,
      ctaLabel: "Open draft room",
      ctaUrl: href,
      tags: ["draft", "draft-end"],
    });
    return;
  }

  await queueOnClockAndOnDeckEmails({
    seasonId: input.seasonId,
    leaguePublicId: input.leaguePublicId,
    leagueName: input.leagueName,
    draftId: input.draftId,
    currentPickIndex: input.nextPickIndex,
    seasonTeams: input.seasonTeams,
  });
}

async function queueOnClockAndOnDeckEmails(input: {
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
      queueEmailsToUsers({
        userIds: [userId],
        dedupeKeyForUser: () =>
          `draft:on_clock:${input.draftId}:${input.currentPickIndex}`,
        subject: `${input.leagueName}: You're on the clock`,
        title: "You're on the clock",
        body: `It's your turn to pick in ${input.leagueName} (pick ${onClock.overall}, round ${onClock.round}).`,
        ctaLabel: "Make your pick",
        ctaUrl: href,
        tags: ["draft", "draft-on-clock"],
      });
    }
  }

  if (onDeck) {
    const userId = byTeam.get(onDeck.teamId);
    if (userId) {
      const onDeckIndex = input.currentPickIndex + 1;
      queueEmailsToUsers({
        userIds: [userId],
        dedupeKeyForUser: () =>
          `draft:on_deck:${input.draftId}:${onDeckIndex}`,
        subject: `${input.leagueName}: You're on deck`,
        title: "You're on deck",
        body: `You're up next in ${input.leagueName} (pick ${onDeck.overall}). Get ready.`,
        ctaLabel: "Open draft room",
        ctaUrl: href,
        tags: ["draft", "draft-on-deck"],
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

/**
 * Live drafts only: remind league when start is ~24h or ~15m away.
 * Designed to run every few minutes via cron-job.org.
 */
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
      draftId: drafts.id,
      draftStatus: drafts.status,
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
    const userIds = await getLeagueOwnerUserIds(row.seasonId);

    if (start >= in23h.getTime() && start <= in25h.getTime()) {
      result.checked24h += 1;
      // Use queue with after — but cron handlers need synchronous send.
      // Fall through to sync helper below.
      const sent = await sendReminderNow({
        userIds,
        dedupePrefix: `draft:remind:24h:${row.seasonId}`,
        subject: `${row.leagueName}: Draft is tomorrow`,
        title: "Draft is tomorrow",
        body: `Your ${row.leagueName} live draft starts around ${row.draftStartAt.toUTCString()}.`,
        ctaUrl: href,
        tags: ["draft", "draft-remind-24h"],
      });
      if (sent > 0) {
        result.sent24h += 1;
      }
    }

    if (start >= in10m.getTime() && start <= in20m.getTime()) {
      result.checked15m += 1;
      const sent = await sendReminderNow({
        userIds,
        dedupePrefix: `draft:remind:15m:${row.seasonId}`,
        subject: `${row.leagueName}: Draft starts in 15 minutes`,
        title: "Draft starts soon",
        body: `Your ${row.leagueName} live draft starts in about 15 minutes. Be ready in the draft room.`,
        ctaUrl: href,
        tags: ["draft", "draft-remind-15m"],
      });
      if (sent > 0) {
        result.sent15m += 1;
      }
    }
  }

  return result;
}

async function sendReminderNow(input: {
  userIds: Array<string | null | undefined>;
  dedupePrefix: string;
  subject: string;
  title: string;
  body: string;
  ctaUrl: string;
  tags: string[];
}) {
  const recipients = await getEmailsForUserIds(input.userIds);
  const content = buildSimpleEmail({
    title: input.title,
    body: input.body,
    ctaLabel: "Open draft room",
    ctaUrl: input.ctaUrl,
  });

  let sent = 0;
  for (const recipient of recipients) {
    const claimed = await claimEmailSend(
      `${input.dedupePrefix}:${recipient.userId}`,
    );
    if (!claimed) {
      continue;
    }
    const result = await sendBrevoEmail({
      to: { email: recipient.email },
      subject: input.subject,
      text: content.text,
      html: content.html,
      tags: input.tags,
    });
    if (result.ok) {
      sent += 1;
    }
  }
  return sent;
}
