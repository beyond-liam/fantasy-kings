import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { teamWatchlist } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getUserTeamForLeague } from "@/lib/queries/watchlist";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  let body: { slug?: string; playerId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request." },
      { status: 400 },
    );
  }

  const { slug, playerId } = body;
  if (!slug || !playerId) {
    return NextResponse.json(
      { success: false, error: "Missing slug or playerId." },
      { status: 400 },
    );
  }

  const team = await getUserTeamForLeague(slug, user.id);
  if (!team) {
    return NextResponse.json(
      { success: false, error: "Team not found." },
      { status: 404 },
    );
  }

  const [existing] = await db
    .select({ id: teamWatchlist.id })
    .from(teamWatchlist)
    .where(
      and(
        eq(teamWatchlist.teamId, team.id),
        eq(teamWatchlist.playerId, playerId),
      ),
    )
    .limit(1);

  if (existing) {
    await db.delete(teamWatchlist).where(eq(teamWatchlist.id, existing.id));
    return NextResponse.json({ success: true, watched: false });
  }

  await db.insert(teamWatchlist).values({
    teamId: team.id,
    playerId,
  });

  return NextResponse.json({ success: true, watched: true });
}
