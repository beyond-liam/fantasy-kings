import { and, eq } from "drizzle-orm";
import { cache } from "react";

import { profiles, teams } from "@/db/schema";
import { formatPersonName } from "@/lib/account/person-name";
import { db } from "@/lib/db";
import { ensureSeasonTeamPublicIds } from "@/lib/leagues/ensure-public-ids";
import { ensureSeasonTeamSlugs } from "@/lib/leagues/team-slug";

export type LeagueTeamDetail = {
  id: string;
  name: string;
  slug: string | null;
  publicId: string;
  userId: string | null;
  leagueSeasonId: string;
  ownerName: string | null;
  logoUrl: string | null;
  waiverPriority: number;
};

const ownerProfileSelect = {
  firstName: profiles.firstName,
  lastName: profiles.lastName,
  username: profiles.username,
  displayName: profiles.displayName,
} as const;

function ownerNameFromRow(row: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  displayName: string | null;
}): string {
  return formatPersonName(row);
}

export const getLeagueTeamByPublicId = cache(
  async (
    leagueSeasonId: string,
    teamPublicId: string,
  ): Promise<LeagueTeamDetail | null> => {
    await ensureSeasonTeamPublicIds(leagueSeasonId);

    const [row] = await db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        publicId: teams.publicId,
        userId: teams.userId,
        leagueSeasonId: teams.leagueSeasonId,
        ...ownerProfileSelect,
        logoUrl: teams.logoUrl,
        waiverPriority: teams.waiverPriority,
      })
      .from(teams)
      .innerJoin(profiles, eq(teams.userId, profiles.id))
      .where(
        and(
          eq(teams.leagueSeasonId, leagueSeasonId),
          eq(teams.publicId, teamPublicId),
        ),
      )
      .limit(1);

    if (!row?.publicId) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      publicId: row.publicId,
      userId: row.userId,
      leagueSeasonId: row.leagueSeasonId,
      ownerName: ownerNameFromRow(row),
      logoUrl: row.logoUrl,
      waiverPriority: row.waiverPriority,
    };
  },
);

/** @deprecated Prefer getLeagueTeamByPublicId */
export const getLeagueTeamBySlug = cache(
  async (
    leagueSeasonId: string,
    teamSlug: string,
  ): Promise<LeagueTeamDetail | null> => {
    await Promise.all([
      ensureSeasonTeamSlugs(leagueSeasonId),
      ensureSeasonTeamPublicIds(leagueSeasonId),
    ]);

    const [row] = await db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        publicId: teams.publicId,
        userId: teams.userId,
        leagueSeasonId: teams.leagueSeasonId,
        ...ownerProfileSelect,
        logoUrl: teams.logoUrl,
        waiverPriority: teams.waiverPriority,
      })
      .from(teams)
      .innerJoin(profiles, eq(teams.userId, profiles.id))
      .where(
        and(
          eq(teams.leagueSeasonId, leagueSeasonId),
          eq(teams.slug, teamSlug),
        ),
      )
      .limit(1);

    if (!row?.publicId) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      publicId: row.publicId,
      userId: row.userId,
      leagueSeasonId: row.leagueSeasonId,
      ownerName: ownerNameFromRow(row),
      logoUrl: row.logoUrl,
      waiverPriority: row.waiverPriority,
    };
  },
);

export const getLeagueTeamById = cache(
  async (
    leagueSeasonId: string,
    teamId: string,
  ): Promise<LeagueTeamDetail | null> => {
    await ensureSeasonTeamPublicIds(leagueSeasonId);

    const [row] = await db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        publicId: teams.publicId,
        userId: teams.userId,
        leagueSeasonId: teams.leagueSeasonId,
        ...ownerProfileSelect,
        logoUrl: teams.logoUrl,
        waiverPriority: teams.waiverPriority,
      })
      .from(teams)
      .innerJoin(profiles, eq(teams.userId, profiles.id))
      .where(
        and(eq(teams.id, teamId), eq(teams.leagueSeasonId, leagueSeasonId)),
      )
      .limit(1);

    if (!row?.publicId) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      publicId: row.publicId,
      userId: row.userId,
      leagueSeasonId: row.leagueSeasonId,
      ownerName: ownerNameFromRow(row),
      logoUrl: row.logoUrl,
      waiverPriority: row.waiverPriority,
    };
  },
);
