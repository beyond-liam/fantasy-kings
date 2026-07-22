import { NextResponse } from "next/server";

/** Accept Vercel Cron (`Authorization: Bearer …`) or `x-cron-secret` header. */
export function assertCronAuthorized(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  const bearer =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : null;
  const headerSecret = request.headers.get("x-cron-secret")?.trim() ?? null;

  if (bearer === secret || headerSecret === secret) {
    return null;
  }

  return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
}
