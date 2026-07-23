import "server-only";

import { requireSessionUser } from "@/lib/auth/session";
import { isRosterTransactionsEnabled } from "@/lib/leagues/free-agency";
import { getSeasonDraftTeams } from "@/lib/queries/draft";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";
import { getUserTeamForSeason } from "@/lib/queries/watchlist";

export type LeagueActionContextOptions = {
  /**
   * Require league membership. Defaults to true when `requireTeam` or
   * `requireCommissioner` is set; otherwise false (draft-style flows).
   */
  requireMembership?: boolean;
  /** Require the caller's team for this season. Implies membership. */
  requireTeam?: boolean;
  /**
   * Require commissioner (or co-commissioner). Pass `"primary"` for the
   * league's primary commissioner only.
   */
  requireCommissioner?: boolean | "primary";
  /** Override the default commissioner denial message. */
  commissionerError?: string;
  /** Include `isCommissioner` on success. */
  includeCommissioner?: boolean;
  /** Include season draft teams + the caller's team from that list. */
  includeSeasonTeams?: boolean;
  /** Fail when free agency / roster transactions are closed. */
  requireFreeAgencyOpen?: boolean;
};

type SessionUser = Awaited<ReturnType<typeof requireSessionUser>>;
type League = NonNullable<Awaited<ReturnType<typeof getLeagueBySlug>>>;
type Season = NonNullable<Awaited<ReturnType<typeof getLeagueSeason>>>;
type Membership = NonNullable<Awaited<ReturnType<typeof getLeagueMembership>>>;
type Team = NonNullable<Awaited<ReturnType<typeof getUserTeamForSeason>>>;
type SeasonDraftTeam = Awaited<ReturnType<typeof getSeasonDraftTeams>>[number];

export type LeagueActionContext = {
  user: SessionUser;
  league: League;
  season: Season;
  membership: Membership | null;
  team: Team | null;
  isCommissioner: boolean;
  seasonTeams: SeasonDraftTeam[];
  userTeam: SeasonDraftTeam | null;
};

export type LeagueMemberTeamContext = Omit<
  LeagueActionContext,
  "membership" | "team"
> & {
  membership: Membership;
  team: Team;
};

export type LeagueActionContextResult =
  | { error: string }
  | LeagueActionContext;

function shouldRequireMembership(options: LeagueActionContextOptions) {
  if (options.requireMembership !== undefined) {
    return options.requireMembership;
  }
  return Boolean(options.requireTeam || options.requireCommissioner);
}

/**
 * Shared auth + league/season bootstrap for mutation actions.
 * Domain files add their own extras (trade by id, waiver player, etc.).
 */
export async function loadLeagueActionContext(
  slug: string,
  options: LeagueActionContextOptions = {},
): Promise<LeagueActionContextResult> {
  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return { error: "League not found." };
  }

  const needMembership = shouldRequireMembership(options);
  const membership = await getLeagueMembership(league.id, user.id);

  if (needMembership && !membership) {
    return { error: "You are not a member of this league." };
  }

  const commissionerDenied =
    options.commissionerError ??
    "Only the commissioner can perform this action.";

  if (options.requireCommissioner === "primary") {
    if (!membership || membership.role !== "commissioner") {
      return { error: commissionerDenied };
    }
  } else if (options.requireCommissioner) {
    const ok =
      membership?.role === "commissioner" ||
      membership?.role === "co_commissioner";
    if (!ok) {
      return { error: commissionerDenied };
    }
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return { error: "League season not found." };
  }

  if (options.requireFreeAgencyOpen && !isRosterTransactionsEnabled(season)) {
    return { error: "Free agency is closed." };
  }

  let team: Team | null = null;
  if (options.requireTeam) {
    team = await getUserTeamForSeason(season.id, user.id);
    if (!team) {
      return { error: "Team not found." };
    }
  }

  const wantCommissionerFlag =
    options.includeCommissioner || Boolean(options.requireCommissioner);
  const isCommissioner = wantCommissionerFlag
    ? membership?.role === "commissioner" ||
      membership?.role === "co_commissioner" ||
      (await isLeagueCommissioner(league.id, user.id))
    : false;

  let seasonTeams: SeasonDraftTeam[] = [];
  let userTeam: SeasonDraftTeam | null = null;
  if (options.includeSeasonTeams) {
    seasonTeams = await getSeasonDraftTeams(season.id);
    userTeam = seasonTeams.find((row) => row.userId === user.id) ?? null;
  }

  return {
    user,
    league,
    season,
    membership,
    team,
    isCommissioner,
    seasonTeams,
    userTeam,
  };
}

/** Membership + team required — trades, waivers, roster adds. */
export async function loadLeagueMemberTeamContext(
  slug: string,
  options: Omit<
    LeagueActionContextOptions,
    "requireMembership" | "requireTeam"
  > = {},
): Promise<{ error: string } | LeagueMemberTeamContext> {
  const result = await loadLeagueActionContext(slug, {
    ...options,
    requireMembership: true,
    requireTeam: true,
  });
  if ("error" in result) {
    return result;
  }
  return {
    ...result,
    membership: result.membership!,
    team: result.team!,
  };
}

/** Draft room: membership required; commissioner + season teams loaded. */
export async function loadDraftActionContext(slug: string) {
  return loadLeagueActionContext(slug, {
    requireMembership: true,
    includeCommissioner: true,
    includeSeasonTeams: true,
  });
}
