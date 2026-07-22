import "server-only";

import { after } from "next/server";

import { claimEmailSend } from "@/lib/email/dedupe";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { getEmailsForUserIds } from "@/lib/email/recipients";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildSimpleEmail(input: {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}) {
  const text = `${input.title}\n\n${input.body}\n\n${input.ctaLabel}: ${input.ctaUrl}`;
  const html = `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111;">
  <h1 style="font-size: 1.25rem;">${escapeHtml(input.title)}</h1>
  <p>${escapeHtml(input.body)}</p>
  <p><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">${escapeHtml(input.ctaLabel)}</a></p>
  <p style="color:#666;font-size:0.875rem;"><a href="${escapeHtml(input.ctaUrl)}">${escapeHtml(input.ctaUrl)}</a></p>
</body>
</html>`;
  return { text, html };
}

/**
 * Claim dedupe keys + send after the response (non-blocking).
 * One email per userId; skips users without email / already claimed.
 */
export function queueEmailsToUsers(input: {
  userIds: Array<string | null | undefined>;
  /** Per-user dedupe key. */
  dedupeKeyForUser: (userId: string) => string;
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  tags?: string[];
}) {
  after(() => {
    void (async () => {
      try {
        const recipients = await getEmailsForUserIds(input.userIds);
        if (recipients.length === 0) {
          return;
        }

        const content = buildSimpleEmail({
          title: input.title,
          body: input.body,
          ctaLabel: input.ctaLabel,
          ctaUrl: input.ctaUrl,
        });

        await Promise.all(
          recipients.map(async (recipient) => {
            const claimed = await claimEmailSend(
              input.dedupeKeyForUser(recipient.userId),
            );
            if (!claimed) {
              return;
            }
            await sendBrevoEmail({
              to: { email: recipient.email },
              subject: input.subject,
              text: content.text,
              html: content.html,
              tags: input.tags,
            });
          }),
        );
      } catch (error) {
        console.error("[email] queueEmailsToUsers failed", error);
      }
    })();
  });
}
