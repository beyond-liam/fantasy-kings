import "server-only";

import { deliverAlert } from "@/lib/alerts/deliver";
import {
  getSeasonOwnerUserIds,
  getTeamOwnerUserIds,
} from "@/lib/alerts/recipients";
import { tradesUrl } from "@/lib/email/env";

/** Trade proposed (or counter) → counterparty in-app + email. */
export async function announceTradeProposed(input: {
  tradeId: string;
  leagueSeasonId: string;
  leaguePublicId: string;
  leagueName: string;
  recipientUserId: string | null | undefined;
  proposingTeamName: string;
  isCounter?: boolean;
}) {
  const title = input.isCounter
    ? "Counter-offer received"
    : "Trade offer received";
  const body = input.isCounter
    ? `${input.proposingTeamName} sent you a counter-offer.`
    : `${input.proposingTeamName} proposed a trade with you.`;
  const emailBody = input.isCounter
    ? `${input.proposingTeamName} sent you a counter-offer in ${input.leagueName}.`
    : `${input.proposingTeamName} proposed a trade with you in ${input.leagueName}.`;

  await deliverAlert({
    userIds: [input.recipientUserId],
    inApp: {
      leagueSeasonId: input.leagueSeasonId,
      leaguePublicId: input.leaguePublicId,
      type: "trade_offer",
      title,
      body,
      tradeId: input.tradeId,
    },
    email: {
      subject: `${input.leagueName}: ${title}`,
      title,
      body: emailBody,
      ctaLabel: "Review trade",
      ctaUrl: tradesUrl(input.leaguePublicId),
      dedupeKeyForUser: () => `trade:propose:${input.tradeId}`,
      tags: ["trade", "trade-propose"],
    },
  });
}

/**
 * Accept into review: in-app to proposer; email to rest of league (veto window).
 */
export async function announceTradeAcceptedReview(input: {
  tradeId: string;
  leagueSeasonId: string;
  leaguePublicId: string;
  leagueName: string;
  proposingTeamName: string;
  receivingTeamName: string;
  proposingUserId: string | null | undefined;
  receivingUserId: string | null | undefined;
  reviewEndsAt: Date | null;
  acceptBody: string;
}) {
  await deliverAlert({
    userIds: [input.proposingUserId],
    inApp: {
      leagueSeasonId: input.leagueSeasonId,
      leaguePublicId: input.leaguePublicId,
      type: "trade_update",
      title: "Trade offer accepted",
      body: input.acceptBody,
      tradeId: input.tradeId,
    },
  });

  const deadline = input.reviewEndsAt
    ? ` Review ends ${input.reviewEndsAt.toUTCString()}.`
    : "";
  const seasonOwners = await getSeasonOwnerUserIds(input.leagueSeasonId);

  await deliverAlert({
    userIds: seasonOwners,
    excludeUserIds: [input.proposingUserId, input.receivingUserId],
    email: {
      subject: `${input.leagueName}: Trade under review`,
      title: "Trade under review",
      body: `${input.proposingTeamName} and ${input.receivingTeamName} agreed to a trade. League members can veto during the review window.${deadline}`,
      ctaLabel: "View trades",
      ctaUrl: tradesUrl(input.leaguePublicId),
      dedupeKeyForUser: (userId) =>
        `trade:review:${input.tradeId}:${userId}`,
      tags: ["trade", "trade-review"],
    },
  });
}

/** Trade vetoed → both sides in-app + email. */
export async function announceTradeVetoed(input: {
  tradeId: string;
  leagueSeasonId: string;
  leaguePublicId: string;
  leagueName: string;
  proposingTeamId: string;
  receivingTeamId: string;
}) {
  const owners = await getTeamOwnerUserIds([
    input.proposingTeamId,
    input.receivingTeamId,
  ]);
  const userIds = [
    owners.get(input.proposingTeamId),
    owners.get(input.receivingTeamId),
  ];

  await deliverAlert({
    userIds,
    inApp: {
      leagueSeasonId: input.leagueSeasonId,
      leaguePublicId: input.leaguePublicId,
      type: "trade_update",
      title: "Trade vetoed",
      body: "Your trade was vetoed by the league.",
      tradeId: input.tradeId,
    },
    email: {
      subject: `${input.leagueName}: Trade vetoed`,
      title: "Trade vetoed",
      body: `Your trade in ${input.leagueName} was vetoed by the league.`,
      ctaLabel: "View trades",
      ctaUrl: tradesUrl(input.leaguePublicId),
      dedupeKeyForUser: (userId) =>
        `trade:vetoed:${input.tradeId}:${userId}`,
      tags: ["trade", "trade-vetoed"],
    },
  });
}
