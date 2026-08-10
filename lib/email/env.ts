import "server-only";

export {
  absoluteAppUrl,
  draftRoomUrl,
  getAppBaseUrl,
  matchupUrl,
  messagesUrl,
  rosterUrl,
  tradesUrl,
  transactionsUrl,
} from "@/lib/email/app-url";

export function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const fromEmail = process.env.BREVO_FROM_EMAIL?.trim();
  const fromName = process.env.BREVO_FROM_NAME?.trim() || "Fantasy Kings";

  if (!apiKey || !fromEmail) {
    return null;
  }

  return { apiKey, fromEmail, fromName };
}
