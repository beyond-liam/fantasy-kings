import "server-only";

import { eq } from "drizzle-orm";

import { emailSends } from "@/db/schema";
import { db } from "@/lib/db";

/**
 * Try to claim a dedupe key. Returns true if this caller should send.
 * Concurrent claimants: unique index — only one insert wins.
 * Callers must release the claim if the send fails or is skipped.
 */
export async function claimEmailSend(dedupeKey: string): Promise<boolean> {
  try {
    await db.insert(emailSends).values({ dedupeKey });
    return true;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : null;
    // Postgres unique_violation
    if (code === "23505") {
      return false;
    }
    throw error;
  }
}

/** Drop a claim so a later retry can send after a failed/skipped Brevo call. */
export async function releaseEmailSend(dedupeKey: string): Promise<void> {
  await db.delete(emailSends).where(eq(emailSends.dedupeKey, dedupeKey));
}
