import { NextResponse } from "next/server";

import { processAllReadyTrades } from "@/lib/cron/process-trades";
import { assertCronAuthorized } from "@/lib/cron/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  const result = await processAllReadyTrades(new Date());
  return NextResponse.json({
    ok: true,
    checked: result.checked,
    processed: result.processed,
    results: result.results,
  });
}

/** Vercel Cron + external schedulers hit this hourly. */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
