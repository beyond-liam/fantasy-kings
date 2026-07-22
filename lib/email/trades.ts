import "server-only";

import { eq } from "drizzle-orm";

import { teams } from "@/db/schema";
import { db } from "@/lib/db";
import { tradesUrl } from "@/lib/email/env";
import { queueEmailsToUsers } from "@/lib/email/send";

export function queueTradeProposalEmail(input: {
  tradeId: string;
  leaguePublicId: string;
  leagueName: string;
  recipientUserId: string | null | undefined;
  proposingTeamName: string;
}) {
  if (!input.recipientUserId) {
    return;
  }

  queueEmailsToUsers({
    userIds: [input.recipientUserId],
    dedupeKeyForUser: () => `trade:propose:${input.tradeId}`,
    subject: `${input.leagueName}: Trade offer received`,
    title: "Trade offer received",
    body: `${input.proposingTeamName} proposed a trade with you in ${input.leagueName}.`,
    ctaLabel: "Review trade",
    ctaUrl: tradesUrl(input.leaguePublicId),
    tags: ["trade", "trade-propose"],
  });
}

/** League-wide when a trade enters the review/veto window. */
export async function queueTradeAcceptedReviewEmails(input: {
  tradeId: string;
  leagueSeasonId: string;
  leaguePublicId: string;
  leagueName: string;
  proposingTeamName: string;
  receivingTeamName: string;
  reviewEndsAt: Date | null;
  excludeUserIds?: Array<string | null | undefined>;
}) {
  const rows = await db
    .select({ userId: teams.userId })
    .from(teams)
    .where(eq(teams.leagueSeasonId, input.leagueSeasonId));

  const exclude = new Set(
    (input.excludeUserIds ?? []).filter((id): id is string => Boolean(id)),
  );

  const deadline = input.reviewEndsAt
    ? ` Review ends ${input.reviewEndsAt.toUTCString()}.`
    : "";

  const userIds = rows
    .map((row) => row.userId)
    .filter((id): id is string => id != null && !exclude.has(id));

  queueEmailsToUsers({
    userIds,
    dedupeKeyForUser: (userId) => `trade:review:${input.tradeId}:${userId}`,
    subject: `${input.leagueName}: Trade under review`,
    title: "Trade under review",
    body: `${input.proposingTeamName} and ${input.receivingTeamName} agreed to a trade. League members can veto during the review window.${deadline}`,
    ctaLabel: "View trades",
    ctaUrl: tradesUrl(input.leaguePublicId),
    tags: ["trade", "trade-review"],
  });
}

export function queueTradeVetoedEmails(input: {
  tradeId: string;
  leaguePublicId: string;
  leagueName: string;
  userIds: Array<string | null | undefined>;
}) {
  queueEmailsToUsers({
    userIds: input.userIds,
    dedupeKeyForUser: (userId) => `trade:vetoed:${input.tradeId}:${userId}`,
    subject: `${input.leagueName}: Trade vetoed`,
    title: "Trade vetoed",
    body: `Your trade in ${input.leagueName} was vetoed by the league.`,
    ctaLabel: "View trades",
    ctaUrl: tradesUrl(input.leaguePublicId),
    tags: ["trade", "trade-vetoed"],
  });
}
