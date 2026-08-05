import { NextResponse } from "next/server";

import { assertCronAuthorized } from "@/lib/cron/auth";
import { sendDueDraftReminders } from "@/lib/alerts/draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const result = await sendDueDraftReminders(new Date());
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("[cron/draft-reminders]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * Draft T-24h / T-15m reminders (live and email drafts).
 * Call every 5 minutes via cron-job.org (Vercel Hobby is daily-only).
 */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
