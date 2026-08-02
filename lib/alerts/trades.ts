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

/** Trade rejected by counterparty → proposer in-app + email. */
export async function announceTradeRejected(input: {
  tradeId: string;
  leagueSeasonId: string;
  leaguePublicId: string;
  leagueName: string;
  proposingTeamId: string;
  rejectingTeamName: string;
}) {
  const owners = await getTeamOwnerUserIds([input.proposingTeamId]);
  await deliverAlert({
    userIds: [owners.get(input.proposingTeamId)],
    inApp: {
      leagueSeasonId: input.leagueSeasonId,
      leaguePublicId: input.leaguePublicId,
      type: "trade_update",
      title: "Trade offer rejected",
      body: `${input.rejectingTeamName} rejected your trade offer.`,
      tradeId: input.tradeId,
    },
    email: {
      subject: `${input.leagueName}: Trade rejected`,
      title: "Trade offer rejected",
      body: `${input.rejectingTeamName} rejected your trade offer in ${input.leagueName}.`,
      ctaLabel: "View trades",
      ctaUrl: tradesUrl(input.leaguePublicId),
      dedupeKeyForUser: (userId) =>
        `trade:rejected:${input.tradeId}:${userId}`,
      tags: ["trade", "trade-rejected"],
    },
  });
}

/** Proposer cancelled → counterparty in-app + email. */
export async function announceTradeCancelled(input: {
  tradeId: string;
  leagueSeasonId: string;
  leaguePublicId: string;
  leagueName: string;
  receivingTeamId: string;
  cancellingTeamName: string;
}) {
  const owners = await getTeamOwnerUserIds([input.receivingTeamId]);
  await deliverAlert({
    userIds: [owners.get(input.receivingTeamId)],
    inApp: {
      leagueSeasonId: input.leagueSeasonId,
      leaguePublicId: input.leaguePublicId,
      type: "trade_update",
      title: "Trade offer cancelled",
      body: `${input.cancellingTeamName} cancelled their trade offer.`,
      tradeId: input.tradeId,
    },
    email: {
      subject: `${input.leagueName}: Trade cancelled`,
      title: "Trade offer cancelled",
      body: `${input.cancellingTeamName} cancelled their trade offer in ${input.leagueName}.`,
      ctaLabel: "View trades",
      ctaUrl: tradesUrl(input.leaguePublicId),
      dedupeKeyForUser: (userId) =>
        `trade:cancelled:${input.tradeId}:${userId}`,
      tags: ["trade", "trade-cancelled"],
    },
  });
}

/** Trade completed (review / commissioner) → both sides in-app + email. */
export async function announceTradeCompleted(input: {
  tradeId: string;
  leagueSeasonId: string;
  leaguePublicId: string;
  leagueName: string;
  proposingTeamId: string;
  receivingTeamId: string;
  title?: string;
  body: string;
  /**
   * Separate keys so "awaiting commissioner" accept does not burn the
   * final "trade completed" email when the commissioner later approves.
   */
  emailDedupeKind?: "completed" | "awaiting_commissioner";
  /** Cron process-trades must send inline (no after()). */
  sync?: boolean;
}) {
  const owners = await getTeamOwnerUserIds([
    input.proposingTeamId,
    input.receivingTeamId,
  ]);
  const title = input.title ?? "Trade completed";
  const kind = input.emailDedupeKind ?? "completed";
  await deliverAlert({
    userIds: [
      owners.get(input.proposingTeamId),
      owners.get(input.receivingTeamId),
    ],
    inApp: {
      leagueSeasonId: input.leagueSeasonId,
      leaguePublicId: input.leaguePublicId,
      type: "trade_update",
      title,
      body: input.body,
      tradeId: input.tradeId,
    },
    email: {
      subject: `${input.leagueName}: ${title}`,
      title,
      body: `${input.body} (${input.leagueName})`,
      ctaLabel: "View trades",
      ctaUrl: tradesUrl(input.leaguePublicId),
      dedupeKeyForUser: (userId) =>
        kind === "awaiting_commissioner"
          ? `trade:awaiting_commissioner:${input.tradeId}:${userId}`
          : `trade:completed:${input.tradeId}:${userId}`,
      tags: ["trade", "trade-completed"],
      sync: input.sync,
    },
  });
}

/** Commissioner rejected → both sides in-app + email. */
export async function announceTradeCommissionerRejected(input: {
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
  await deliverAlert({
    userIds: [
      owners.get(input.proposingTeamId),
      owners.get(input.receivingTeamId),
    ],
    inApp: {
      leagueSeasonId: input.leagueSeasonId,
      leaguePublicId: input.leaguePublicId,
      type: "trade_update",
      title: "Trade rejected",
      body: "The commissioner rejected your trade.",
      tradeId: input.tradeId,
    },
    email: {
      subject: `${input.leagueName}: Trade rejected`,
      title: "Trade rejected",
      body: `The commissioner rejected your trade in ${input.leagueName}.`,
      ctaLabel: "View trades",
      ctaUrl: tradesUrl(input.leaguePublicId),
      dedupeKeyForUser: (userId) =>
        `trade:comm-rejected:${input.tradeId}:${userId}`,
      tags: ["trade", "trade-rejected"],
    },
  });
}
