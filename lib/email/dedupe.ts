import "server-only";

import { emailSends } from "@/db/schema";
import { db } from "@/lib/db";

/**
 * Try to claim a dedupe key. Returns true if this caller should send.
 * Concurrent claimants: unique index — only one insert wins.
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
