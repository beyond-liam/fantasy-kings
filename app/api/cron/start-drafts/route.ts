import { NextResponse } from "next/server";

import { assertCronAuthorized } from "@/lib/cron/auth";
import { autoStartDueDrafts } from "@/lib/leagues/draft/auto-start";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  const result = await autoStartDueDrafts(new Date());
  return NextResponse.json({
    ok: true,
    ...result,
  });
}

/** Vercel Cron + external schedulers — run every 1–5 minutes near draft windows. */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
