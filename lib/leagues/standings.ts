import { resolveFaabRemaining } from "@/lib/leagues/waivers/faab";

export type LeagueStandingsRow = {
  id: string;
  teamId: string | null;
  teamPublicId: string | null;
  claimed: boolean;
  teamName: string;
  ownerName: string;
  logoUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  gamesBehind: number | null;
  streak: string | null;
  pointsFor: number;
  pointsForAvg: number;
  pointsAgainst: number;
  pointsAgainstAvg: number;
  waiverPriority: number | null;
  /** Remaining FAAB when budgets are enabled; null otherwise. */
  faabRemaining: number | null;
  rank: number | null;
  draftOrder: number | null;
  opponentName: string | null;
};

export type LeagueStandingsMember = {
  teamId: string | null;
  teamName: string | null;
  teamPublicId?: string | null;
  displayName: string | null;
  /** When set, team is claimed by this user. */
  userId?: string | null;
  draftSlot: number | null;
  teamCreatedAt: Date | null;
  waiverPriority?: number | null;
  faabRemaining?: number | null;
  logoUrl?: string | null;
};

export type BuildStandingsOptions = {
  teamCount: number;
  /** Starting / remaining FAAB when waiver type is FAAB; omit or null for priority-only. */
  faabBudget?: number | null;
};

/** Finalized H2H row used to compute W/L/PF standings. */
export type FinalMatchupRecord = {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homePts: number | null;
  awayPts: number | null;
};

function emptyStats() {
  return {
    wins: 0,
    losses: 0,
    ties: 0,
    winPct: 0,
    gamesBehind: null as number | null,
    streak: null as string | null,
    pointsFor: 0,
    pointsForAvg: 0,
    pointsAgainst: 0,
    pointsAgainstAvg: 0,
    opponentName: null as string | null,
  };
}

/** Placeholder standings until matchups / scoring wire up. */
export function buildPlaceholderStandings(
  members: LeagueStandingsMember[],
  options: BuildStandingsOptions,
): LeagueStandingsRow[] {
  const { teamCount, faabBudget = null } = options;
  const showFaab = faabBudget != null && faabBudget > 0;

  const withTeams = members
    .filter(
      (member): member is LeagueStandingsMember & { teamId: string } =>
        Boolean(member.teamId),
    )
    .map((member) => ({
      teamId: member.teamId,
      teamName: member.teamName?.trim() || "Unnamed team",
      teamPublicId: member.teamPublicId?.trim() || null,
      claimed: Boolean(member.userId),
      ownerName: member.userId
        ? member.displayName?.trim() || "Manager"
        : "Available",
      draftSlot: member.draftSlot,
      teamCreatedAt: member.teamCreatedAt,
      waiverPriority: member.waiverPriority ?? null,
      faabRemaining: member.faabRemaining ?? null,
      logoUrl: member.logoUrl?.trim() || null,
    }))
    .sort((a, b) => {
      if (a.claimed !== b.claimed) {
        return a.claimed ? -1 : 1;
      }
      const aPri = a.waiverPriority ?? Number.POSITIVE_INFINITY;
      const bPri = b.waiverPriority ?? Number.POSITIVE_INFINITY;
      if (aPri !== bPri) {
        return aPri - bPri;
      }
      const aTime = a.teamCreatedAt?.getTime() ?? 0;
      const bTime = b.teamCreatedAt?.getTime() ?? 0;
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      return a.teamName.localeCompare(b.teamName);
    });

  const rows: LeagueStandingsRow[] = withTeams.map((team, index) => ({
    id: team.teamId,
    teamId: team.teamId,
    teamPublicId: team.teamPublicId,
    claimed: team.claimed,
    teamName: team.teamName,
    ownerName: team.ownerName,
    logoUrl: team.claimed ? team.logoUrl : null,
    ...emptyStats(),
    waiverPriority: team.claimed ? (team.waiverPriority ?? index + 1) : null,
    faabRemaining:
      team.claimed && showFaab
        ? resolveFaabRemaining(team.faabRemaining, faabBudget)
        : null,
    rank: team.claimed ? 1 : null,
    draftOrder: team.draftSlot,
  }));

  // Back-compat: synthesize open slots when seasons predate real unclaimed rows.
  const openSlots = Math.max(0, teamCount - rows.length);
  const unclaimedRows: LeagueStandingsRow[] = Array.from(
    { length: openSlots },
    (_, index) => ({
      id: `unclaimed-${index + 1}`,
      teamId: null,
      teamPublicId: null,
      claimed: false,
      teamName: "Unclaimed team",
      ownerName: "Available",
      logoUrl: null,
      ...emptyStats(),
      waiverPriority: null,
      faabRemaining: null,
      rank: null,
      draftOrder: null,
    }),
  );

  return [...rows, ...unclaimedRows];
}

export function formatRecord(wins: number, losses: number, ties = 0) {
  if (ties > 0) {
    return `${wins}-${losses}-${ties}`;
  }
  return `${wins}-${losses}`;
}

export function formatWinPct(winPct: number) {
  return winPct.toFixed(3).replace(/^0/, "") || ".000";
}

export function formatGamesBehind(gamesBehind: number | null) {
  if (gamesBehind == null || gamesBehind === 0) {
    return "—";
  }
  return Number.isInteger(gamesBehind)
    ? String(gamesBehind)
    : gamesBehind.toFixed(1);
}

export function formatPoints(value: number) {
  return value.toFixed(1);
}

/** Positive = win streak, negative = loss streak, 0 = none. */
export function streakSortValue(streak: string | null) {
  if (!streak) {
    return 0;
  }
  const match = /^([WL])(\d+)$/i.exec(streak.trim());
  if (!match) {
    return 0;
  }
  const length = Number(match[2]);
  return match[1]!.toUpperCase() === "W" ? length : -length;
}

export function teamInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}
