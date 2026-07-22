import { asc, count, eq } from "drizzle-orm";

import { teams } from "@/db/schema";
import { db } from "@/lib/db";
import { allocateUniqueTeamSlug } from "@/lib/leagues/utils";
import { generatePublicId } from "@/lib/leagues/public-id";

type EnsureTeamSlotsOptions = {
  waiversEnabled: boolean;
  waiverType: "priority" | "faab";
  faabBudget: number | null;
  autoPickEnabled: boolean;
};

/** Create missing open team rows so Claim Team can target real slot IDs. */
export async function ensureSeasonTeamSlots(
  leagueSeasonId: string,
  teamCount: number,
  options: EnsureTeamSlotsOptions,
) {
  const existing = await db
    .select({
      id: teams.id,
      slug: teams.slug,
      draftSlot: teams.draftSlot,
    })
    .from(teams)
    .where(eq(teams.leagueSeasonId, leagueSeasonId))
    .orderBy(asc(teams.draftSlot), asc(teams.createdAt));

  const missing = Math.max(0, teamCount - existing.length);
  if (missing === 0) {
    return;
  }

  const takenSlugs = new Set(
    existing
      .map((row) => row.slug)
      .filter((slug): slug is string => Boolean(slug)),
  );
  const usedSlots = new Set(
    existing
      .map((row) => row.draftSlot)
      .filter((slot): slot is number => slot != null),
  );

  const rows = [];
  let nextSlot = 1;
  for (let i = 0; i < missing; i++) {
    while (usedSlots.has(nextSlot)) {
      nextSlot += 1;
    }
    const name = `Team ${nextSlot}`;
    const slug = allocateUniqueTeamSlug(name, takenSlugs);
    takenSlugs.add(slug);
    usedSlots.add(nextSlot);
    rows.push({
      leagueSeasonId,
      userId: null,
      name,
      publicId: generatePublicId(),
      slug,
      draftSlot: nextSlot,
      autoPickEnabled: options.autoPickEnabled,
      waiverPriority: nextSlot,
      faabRemaining:
        options.waiversEnabled && options.waiverType === "faab"
          ? options.faabBudget
          : null,
    });
    nextSlot += 1;
  }

  if (rows.length > 0) {
    await db.insert(teams).values(rows);
  }
}

export async function countClaimedTeams(leagueSeasonId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(teams)
    .where(eq(teams.leagueSeasonId, leagueSeasonId));
  // count all teams; claimed checked separately by callers when needed
  return Number(row?.value ?? 0);
}
