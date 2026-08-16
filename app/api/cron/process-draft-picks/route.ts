import { NextResponse } from "next/server";

import { assertCronAuthorized } from "@/lib/cron/auth";
import { processExpiredDraftPicks } from "@/lib/leagues/draft/process-expired-picks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const result = await processExpiredDraftPicks(new Date());
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("[cron/process-draft-picks]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to process expired draft picks." },
      { status: 500 },
    );
  }
}

/** Autopick due draft seats (immediate queue + expired open). Cron every 1–5m. */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
