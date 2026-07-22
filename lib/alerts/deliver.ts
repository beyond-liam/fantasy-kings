import "server-only";

import { after } from "next/server";

import { claimEmailSend } from "@/lib/email/dedupe";
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
    await createNotifications(rows);
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

function queueEmailsAfter(userIds: string[], email: EmailAlert) {
  after(() => {
    void sendEmailsNow(userIds, email).catch((error) => {
      console.error("[alerts] email adapter failed", error);
    });
  });
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

  let sent = 0;
  await Promise.all(
    withAddresses.map(async (recipient) => {
      const claimed = await claimEmailSend(
        email.dedupeKeyForUser(recipient.userId),
      );
      if (!claimed) {
        return;
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
      }
    }),
  );
  return sent;
}
