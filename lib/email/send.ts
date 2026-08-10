import "server-only";

import { absoluteAppUrl } from "@/lib/email/app-url";

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
  const ctaUrl = absoluteAppUrl(input.ctaUrl);
  const text = `${input.title}\n\n${input.body}\n\n${input.ctaLabel}: ${ctaUrl}`;
  const html = `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111;">
  <h1 style="font-size: 1.25rem;">${escapeHtml(input.title)}</h1>
  <p>${escapeHtml(input.body)}</p>
  <p><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">${escapeHtml(input.ctaLabel)}</a></p>
  <p style="color:#666;font-size:0.875rem;"><a href="${escapeHtml(ctaUrl)}">${escapeHtml(ctaUrl)}</a></p>
</body>
</html>`;
  return { text, html };
}
