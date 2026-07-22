import { NextResponse } from "next/server";

import { assertCronAuthorized } from "@/lib/cron/auth";
import { sendDueDraftReminders } from "@/lib/email/draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  const result = await sendDueDraftReminders(new Date());
  return NextResponse.json({
    ok: true,
    ...result,
  });
}

/**
 * Live draft T-24h / T-15m reminders.
 * Call every 5 minutes via cron-job.org (Vercel Hobby is daily-only).
 */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
