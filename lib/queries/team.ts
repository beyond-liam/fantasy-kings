import { and, eq } from "drizzle-orm";
import { cache } from "react";

import { profiles, teams } from "@/db/schema";
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
};

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
        ownerName: profiles.displayName,
        logoUrl: teams.logoUrl,
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

    return { ...row, publicId: row.publicId };
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
        ownerName: profiles.displayName,
        logoUrl: teams.logoUrl,
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

    return { ...row, publicId: row.publicId };
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
        ownerName: profiles.displayName,
        logoUrl: teams.logoUrl,
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

    return { ...row, publicId: row.publicId };
  },
);
