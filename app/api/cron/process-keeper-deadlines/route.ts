import { NextResponse } from "next/server";

import { assertCronAuthorized } from "@/lib/cron/auth";
import { processAllDueKeeperDeadlines } from "@/lib/leagues/keepers/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  const result = await processAllDueKeeperDeadlines(new Date());
  return NextResponse.json({
    ok: true,
    checked: result.checked,
    processed: result.processed,
    results: result.results,
  });
}

/** Vercel Cron (daily backup) + cron-job.org for timely deadline clears. */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
