import { and, count, desc, eq, asc, inArray } from "drizzle-orm";
import { cache } from "react";

import {
  drafts,
  leagueMembers,
  leagues,
  leagueSeasons,
  teams,
} from "@/db/schema";
import { profiles } from "@/db/schema/users";
import { db } from "@/lib/db";
import { ensureSeasonTeamSlugs } from "@/lib/leagues/team-slug";
import { ensureSeasonTeamPublicIds } from "@/lib/leagues/ensure-public-ids";
import { ensureSeasonTeamSlots } from "@/lib/leagues/ensure-team-slots";
import { getDraftBySeasonId } from "@/lib/queries/draft";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";
import { buildLeagueStandings } from "@/lib/leagues/standings-from-matchups";
import { getFinalMatchupsForSeasons } from "@/lib/leagues/matchups/finalize";

export type DraftUnderwayStatus = "live" | "paused";

export function isDraftUnderway(
  status: string | null | undefined,
): status is DraftUnderwayStatus {
  return status === "live" || status === "paused";
}

export type UserLeagueListItem = {
  id: string;
  name: string;
  publicId: string;
  slug: string;
  inviteCode: string;
  commissionerId: string;
  createdAt: Date;
  role: string;
  draftStatus: string | null;
  draftType: "live" | "email" | null;
  draftStartAt: Date | null;
  logoUrl: string | null;
  leagueType: string;
  teamName: string | null;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  streak: string | null;
  rank: number | null;
};

export async function getUserLeagues(
  userId: string,
): Promise<UserLeagueListItem[]> {
  const rows = await db
    .select({
      id: leagues.id,
      name: leagues.name,
      publicId: leagues.publicId,
      slug: leagues.slug,
      inviteCode: leagues.inviteCode,
      commissionerId: leagues.commissionerId,
      createdAt: leagues.createdAt,
      role: leagueMembers.role,
      draftStatus: drafts.status,
      draftType: leagueSeasons.draftType,
      draftStartAt: leagueSeasons.draftStartAt,
      settings: leagueSeasons.settings,
      leagueType: leagueSeasons.leagueType,
      seasonId: leagueSeasons.id,
      teamId: teams.id,
      teamName: teams.name,
    })
    .from(leagueMembers)
    .innerJoin(leagues, eq(leagueMembers.leagueId, leagues.id))
    .leftJoin(leagueSeasons, eq(leagueSeasons.leagueId, leagues.id))
    .leftJoin(drafts, eq(drafts.leagueSeasonId, leagueSeasons.id))
    .leftJoin(
      teams,
      and(
        eq(teams.leagueSeasonId, leagueSeasons.id),
        eq(teams.userId, userId),
      ),
    )
    .where(eq(leagueMembers.userId, userId))
    .orderBy(leagues.createdAt);

  const seasonIds = [
    ...new Set(
      rows
        .map((row) => row.seasonId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [finalsBySeason, seasonTeams] = await Promise.all([
    getFinalMatchupsForSeasons(seasonIds),
    seasonIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: teams.id,
            leagueSeasonId: teams.leagueSeasonId,
            name: teams.name,
            publicId: teams.publicId,
            userId: teams.userId,
            draftSlot: teams.draftSlot,
            createdAt: teams.createdAt,
            waiverPriority: teams.waiverPriority,
            logoUrl: teams.logoUrl,
          })
          .from(teams)
          .where(inArray(teams.leagueSeasonId, seasonIds)),
  ]);

  const teamsBySeason = new Map<string, typeof seasonTeams>();
  for (const team of seasonTeams) {
    const list = teamsBySeason.get(team.leagueSeasonId) ?? [];
    list.push(team);
    teamsBySeason.set(team.leagueSeasonId, list);
  }

  const standingByTeamId = new Map<
    string,
    {
      wins: number;
      losses: number;
      ties: number;
      winPct: number;
      streak: string | null;
      rank: number | null;
    }
  >();

  for (const seasonId of seasonIds) {
    const seasonTeamRows = teamsBySeason.get(seasonId) ?? [];
    const members: LeagueStandingsMember[] = seasonTeamRows.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      teamPublicId: team.publicId,
      displayName: null,
      userId: team.userId,
      draftSlot: team.draftSlot,
      teamCreatedAt: team.createdAt,
      waiverPriority: team.waiverPriority,
      logoUrl: team.logoUrl,
    }));
    const standings = buildLeagueStandings(
      members,
      { teamCount: members.length },
      finalsBySeason.get(seasonId) ?? [],
    );
    for (const row of standings) {
      if (!row.teamId) continue;
      standingByTeamId.set(row.teamId, {
        wins: row.wins,
        losses: row.losses,
        ties: row.ties,
        winPct: row.winPct,
        streak: row.streak,
        rank: row.rank,
      });
    }
  }

  return rows.map((row) => {
    const record =
      row.teamId != null ? standingByTeamId.get(row.teamId) : undefined;
    return {
      id: row.id,
      name: row.name,
      publicId: row.publicId,
      slug: row.slug,
      inviteCode: row.inviteCode,
      commissionerId: row.commissionerId,
      createdAt: row.createdAt,
      role: row.role,
      draftStatus: row.draftStatus,
      draftType: row.draftType ?? null,
      draftStartAt: row.draftStartAt ?? null,
      logoUrl: row.settings?.logoUrl?.trim() || null,
      leagueType: row.leagueType ?? "redraft",
      teamName: row.teamName?.trim() || null,
      wins: record?.wins ?? 0,
      losses: record?.losses ?? 0,
      ties: record?.ties ?? 0,
      winPct: record?.winPct ?? 0,
      streak: record?.streak ?? null,
      rank: record?.rank ?? null,
    };
  });
}

export const getLeagueByPublicId = cache(async (publicId: string) => {
  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.publicId, publicId))
    .limit(1);
  return league ?? null;
});

/** Resolve by public id, then legacy slug (for old bookmarks). */
export const getLeagueBySlug = cache(async (idOrSlug: string) => {
  const byPublicId = await getLeagueByPublicId(idOrSlug);
  if (byPublicId) {
    return byPublicId;
  }
  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.slug, idOrSlug))
    .limit(1);
  return league ?? null;
});

export async function getLeagueByInviteCode(inviteCode: string) {
  const normalized = inviteCode.toUpperCase();
  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.inviteCode, normalized))
    .limit(1);
  return league ?? null;
}

export const getLeagueMembership = cache(
  async (leagueId: string, userId: string) => {
    const [member] = await db
      .select({ id: leagueMembers.id, role: leagueMembers.role })
      .from(leagueMembers)
      .where(
        and(
          eq(leagueMembers.leagueId, leagueId),
          eq(leagueMembers.userId, userId),
        ),
      )
      .limit(1);

    return member ?? null;
  },
);

export async function isLeagueMember(leagueId: string, userId: string) {
  return Boolean(await getLeagueMembership(leagueId, userId));
}

export async function isLeagueCommissioner(leagueId: string, userId: string) {
  const member = await getLeagueMembership(leagueId, userId);
  return (
    member?.role === "commissioner" || member?.role === "co_commissioner"
  );
}

/** Primary commissioner only (not co-commissioners). */
export async function isPrimaryCommissioner(
  leagueId: string,
  userId: string,
) {
  const member = await getLeagueMembership(leagueId, userId);
  return member?.role === "commissioner";
}

/** Invite code for the creator success page — commissioner only. */
export async function getLeagueInviteForCommissioner(
  idOrSlug: string,
  userId: string,
) {
  const league = await getLeagueBySlug(idOrSlug);
  if (!league) {
    return null;
  }
  if (!(await isLeagueCommissioner(league.id, userId))) {
    return null;
  }
  return {
    publicId: league.publicId,
    slug: league.slug,
    inviteCode: league.inviteCode,
  };
}

export const getLeagueSeason = cache(async (leagueId: string) => {
  const [season] = await db
    .select()
    .from(leagueSeasons)
    .where(eq(leagueSeasons.leagueId, leagueId))
    .orderBy(desc(leagueSeasons.seasonYear))
    .limit(1);

  return season ?? null;
});

/** Season years for a league, newest first. */
export const getLeagueSeasonYears = cache(async (leagueId: string) => {
  const rows = await db
    .select({ seasonYear: leagueSeasons.seasonYear })
    .from(leagueSeasons)
    .where(eq(leagueSeasons.leagueId, leagueId))
    .orderBy(desc(leagueSeasons.seasonYear));

  return rows.map((row) => row.seasonYear);
});

export const getLeagueSeasonByYear = cache(
  async (leagueId: string, seasonYear: number) => {
    const [season] = await db
      .select()
      .from(leagueSeasons)
      .where(
        and(
          eq(leagueSeasons.leagueId, leagueId),
          eq(leagueSeasons.seasonYear, seasonYear),
        ),
      )
      .limit(1);

    return season ?? null;
  },
);

export async function getJoinPreview(inviteCode: string) {
  const league = await getLeagueByInviteCode(inviteCode);
  if (!league) {
    return null;
  }

  const [season] = await db
    .select()
    .from(leagueSeasons)
    .where(eq(leagueSeasons.leagueId, league.id))
    .orderBy(leagueSeasons.createdAt)
    .limit(1);

  if (season) {
    await ensureSeasonTeamSlots(season.id, season.teamCount, {
      waiversEnabled: season.waiversEnabled,
      waiverType: season.waiverType,
      faabBudget: season.faabBudget,
      autoPickEnabled: season.settings.draft?.autoPickEnabled ?? false,
    });
    await Promise.all([
      ensureSeasonTeamSlugs(season.id),
      ensureSeasonTeamPublicIds(season.id),
    ]);
  }

  const [memberCountRow] = await db
    .select({ value: count() })
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, league.id));

  const [commissioner] = await db
    .select({ displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.id, league.commissionerId))
    .limit(1);

  const standingsTeams: LeagueStandingsMember[] = season
    ? await db
        .select({
          teamId: teams.id,
          teamName: teams.name,
          teamPublicId: teams.publicId,
          userId: teams.userId,
          displayName: profiles.displayName,
          draftSlot: teams.draftSlot,
          teamCreatedAt: teams.createdAt,
          waiverPriority: teams.waiverPriority,
          faabRemaining: teams.faabRemaining,
          logoUrl: teams.logoUrl,
        })
        .from(teams)
        .leftJoin(profiles, eq(teams.userId, profiles.id))
        .where(eq(teams.leagueSeasonId, season.id))
        .orderBy(asc(teams.draftSlot), asc(teams.createdAt))
    : [];

  return {
    league,
    season,
    memberCount: Number(memberCountRow?.value ?? 0),
    commissionerName: commissioner?.displayName ?? "Commissioner",
    acceptingMembers: season?.status === "recruiting",
    standingsTeams,
  };
}

export const getLeagueHomeData = cache(async (slug: string, userId: string) => {
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return null;
  }

  const membership = await getLeagueMembership(league.id, userId);
  if (!membership) {
    return { league, isMember: false as const };
  }

  const season = await getLeagueSeason(league.id);
  if (season) {
    await ensureSeasonTeamSlots(season.id, season.teamCount, {
      waiversEnabled: season.waiversEnabled,
      waiverType: season.waiverType,
      faabBudget: season.faabBudget,
      autoPickEnabled: season.settings.draft?.autoPickEnabled ?? false,
    });
    await Promise.all([
      ensureSeasonTeamSlugs(season.id),
      ensureSeasonTeamPublicIds(season.id),
    ]);
  }

  const [draft, members, standingsTeams] = await Promise.all([
    season ? getDraftBySeasonId(season.id) : Promise.resolve(null),
    db
      .select({
        userId: leagueMembers.userId,
        role: leagueMembers.role,
        displayName: profiles.displayName,
        teamId: teams.id,
        teamName: teams.name,
        teamSlug: teams.slug,
        teamPublicId: teams.publicId,
        draftSlot: teams.draftSlot,
        teamCreatedAt: teams.createdAt,
        waiverPriority: teams.waiverPriority,
        faabRemaining: teams.faabRemaining,
        logoUrl: teams.logoUrl,
      })
      .from(leagueMembers)
      .innerJoin(profiles, eq(leagueMembers.userId, profiles.id))
      .leftJoin(
        teams,
        season
          ? and(
              eq(teams.leagueSeasonId, season.id),
              eq(teams.userId, leagueMembers.userId),
            )
          : eq(teams.userId, leagueMembers.userId),
      )
      .where(eq(leagueMembers.leagueId, league.id)),
    season
      ? db
          .select({
            teamId: teams.id,
            teamName: teams.name,
            teamPublicId: teams.publicId,
            userId: teams.userId,
            displayName: profiles.displayName,
            draftSlot: teams.draftSlot,
            teamCreatedAt: teams.createdAt,
            waiverPriority: teams.waiverPriority,
            faabRemaining: teams.faabRemaining,
            logoUrl: teams.logoUrl,
          })
          .from(teams)
          .leftJoin(profiles, eq(teams.userId, profiles.id))
          .where(eq(teams.leagueSeasonId, season.id))
          .orderBy(asc(teams.draftSlot), asc(teams.createdAt))
      : Promise.resolve([] as LeagueStandingsMember[]),
  ]);

  return {
    league,
    isMember: true as const,
    season,
    draftStatus: draft?.status ?? null,
    members,
    standingsTeams,
  };
});

