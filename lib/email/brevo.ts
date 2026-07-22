import "server-only";

import { getBrevoConfig } from "@/lib/email/env";

export type SendEmailInput = {
  to: { email: string; name?: string | null };
  subject: string;
  text: string;
  html: string;
  tags?: string[];
};

export type SendEmailResult =
  | { ok: true; messageId?: string }
  | { ok: false; skipped?: boolean; error: string };

/**
 * Send one transactional email via Brevo REST API.
 * No-ops (skipped) when Brevo env is missing so local/dev stays safe.
 */
export async function sendBrevoEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const config = getBrevoConfig();
  if (!config) {
    console.warn("[email] Brevo not configured; skipping send:", input.subject);
    return { ok: false, skipped: true, error: "Brevo not configured." };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": config.apiKey,
    },
    body: JSON.stringify({
      sender: {
        email: config.fromEmail,
        name: config.fromName,
      },
      to: [
        {
          email: input.to.email,
          ...(input.to.name ? { name: input.to.name } : {}),
        },
      ],
      subject: input.subject,
      textContent: input.text,
      htmlContent: input.html,
      tags: input.tags,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[email] Brevo send failed", response.status, body);
    return {
      ok: false,
      error: `Brevo HTTP ${response.status}`,
    };
  }

  const json = (await response.json().catch(() => null)) as {
    messageId?: string;
  } | null;

  return { ok: true, messageId: json?.messageId };
}
