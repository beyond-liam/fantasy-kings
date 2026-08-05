import "server-only";

import { after } from "next/server";

import { claimEmailSend, releaseEmailSend } from "@/lib/email/dedupe";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { getEmailsForUserIds } from "@/lib/email/recipients";
import { buildSimpleEmail } from "@/lib/email/send";
import {
  createNotifications,
  tradesHref,
  type CreateNotificationInput,
} from "@/lib/notifications/create";
import type { NotificationType } from "@/db/schema/notifications";
import { uniqueUserIds } from "@/lib/alerts/recipients";

export type InAppAlert = {
  leagueSeasonId: string;
  leaguePublicId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  tradeId?: string | null;
  claimId?: string | null;
  playerId?: string | null;
};

export type EmailAlert = {
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  dedupeKeyForUser: (userId: string) => string;
  tags?: string[];
  /** Cron paths: send inline instead of after(). */
  sync?: boolean;
};

/**
 * One delivery plan: same recipients, optional in-app + email adapters.
 * Call twice with different audiences when channels need different people.
 */
export async function deliverAlert(input: {
  userIds: Array<string | null | undefined>;
  excludeUserIds?: Array<string | null | undefined>;
  inApp?: InAppAlert;
  email?: EmailAlert;
}): Promise<{ emailed: number }> {
  const recipients = uniqueUserIds(input.userIds, input.excludeUserIds);
  if (recipients.length === 0) {
    return { emailed: 0 };
  }

  if (input.inApp) {
    const href =
      input.inApp.href ?? tradesHref(input.inApp.leaguePublicId);
    const rows: CreateNotificationInput[] = recipients.map(
      (recipientUserId) => ({
        recipientUserId,
        leagueSeasonId: input.inApp!.leagueSeasonId,
        type: input.inApp!.type,
        title: input.inApp!.title,
        body: input.inApp!.body,
        href,
        tradeId: input.inApp!.tradeId ?? null,
        claimId: input.inApp!.claimId ?? null,
        playerId: input.inApp!.playerId ?? null,
      }),
    );
    // Cron/sync paths keep in-app writes inline; user mutations defer.
    if (input.email?.sync) {
      await createNotifications(rows);
    } else {
      queueInAppAfter(rows);
    }
  }

  if (!input.email) {
    return { emailed: 0 };
  }

  if (input.email.sync) {
    return { emailed: await sendEmailsNow(recipients, input.email) };
  }

  queueEmailsAfter(recipients, input.email);
  return { emailed: 0 };
}

function queueInAppAfter(rows: CreateNotificationInput[]) {
  try {
    after(() => {
      void createNotifications(rows).catch((error) => {
        console.error("[alerts] in-app adapter failed", error);
      });
    });
  } catch {
    // Outside a Next.js request — write inline so tests/scripts still notify.
    void createNotifications(rows).catch((error) => {
      console.error("[alerts] in-app adapter failed", error);
    });
  }
}

function queueEmailsAfter(userIds: string[], email: EmailAlert) {
  try {
    after(() => {
      void sendEmailsNow(userIds, email).catch((error) => {
        console.error("[alerts] email adapter failed", error);
      });
    });
  } catch {
    // Outside a Next.js request (scripts, node:test) — send inline like in-app.
    void sendEmailsNow(userIds, email).catch((error) => {
      console.error("[alerts] email adapter failed", error);
    });
  }
}

async function sendEmailsNow(userIds: string[], email: EmailAlert) {
  const withAddresses = await getEmailsForUserIds(userIds);
  if (withAddresses.length === 0) {
    return 0;
  }

  const content = buildSimpleEmail({
    title: email.title,
    body: email.body,
    ctaLabel: email.ctaLabel,
    ctaUrl: email.ctaUrl,
  });

  // Sequential: runtime DB pool is max:1 — parallel inserts race the connection.
  let sent = 0;
  for (const recipient of withAddresses) {
    const dedupeKey = email.dedupeKeyForUser(recipient.userId);
    const claimed = await claimEmailSend(dedupeKey);
    if (!claimed) {
      continue;
    }
    const result = await sendBrevoEmail({
      to: { email: recipient.email },
      subject: email.subject,
      text: content.text,
      html: content.html,
      tags: email.tags,
    });
    if (result.ok) {
      sent += 1;
      continue;
    }
    // Failed or skipped (e.g. Brevo unset) — free the key so retries can send.
    await releaseEmailSend(dedupeKey).catch((error) => {
      console.error(
        "[alerts] failed to release email claim",
        dedupeKey,
        error,
      );
    });
  }
  return sent;
}
