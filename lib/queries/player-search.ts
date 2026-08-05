import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring";
import type { ScoringPreset } from "@/lib/leagues/scoring";
import { isRosterTransactionsEnabled } from "@/lib/leagues/free-agency";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import { resolvePlayerAcquisitionKind } from "@/lib/leagues/waivers/resolve-kind";
import { getDraftBySeasonId } from "@/lib/queries/draft";
import {
  getRankedPlayers,
  type RankedPlayerRow,
} from "@/lib/queries/players";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
} from "@/lib/queries/leagues";
import {
  getLeaguePlayerOwnershipMap,
  resolvePlayerOwnership,
} from "@/lib/queries/roster";
import { getTeamPendingClaimPlayerIds } from "@/lib/queries/waivers";
import { getUserTeamForSeason } from "@/lib/queries/watchlist";
import { SCORE_ROWS_HARD_CAP } from "@/lib/queries/score-rows";
import {
  PLAYER_SEARCH_PAGE_SIZE,
  type PlayerSearchRow,
} from "@/lib/rankings/player-search";
import type { SleeperNflState } from "@/lib/sleeper/api";
import { getNflState } from "@/lib/sleeper/api";

export { PLAYER_SEARCH_PAGE_SIZE, type PlayerSearchRow };

/**
 * Prefer projected season points until regular-season week 1 has started;
 * then sort/search against actual season points.
 */
export function resolvePlayerSearchSource(nfl: SleeperNflState): {
  kind: "projection" | "stats";
  week: number;
} {
  const week = Math.max(nfl.week || 0, nfl.display_week || 0);
  if (nfl.season_type === "regular" && week >= 1) {
    return { kind: "stats", week: 0 };
  }
  return { kind: "projection", week: 0 };
}

function toSearchRow(row: RankedPlayerRow): PlayerSearchRow {
  return {
    id: row.id,
    fullName: row.fullName,
    sleeperId: row.sleeperId,
    primaryPositionId: row.primaryPositionId,
    nflTeam: row.nflTeam,
    byeWeek: row.byeWeek,
    injuryStatus: row.injuryStatus,
    fantasyPts: row.fantasyPts,
    fantasyTeamId: row.fantasyTeamId,
    fantasyTeamName: row.fantasyTeamName,
    fantasyTeamSlug: row.fantasyTeamSlug,
    isOwnedByCurrentUser: row.isOwnedByCurrentUser,
    onWaivers: row.onWaivers,
    acquisitionKind: row.acquisitionKind,
    hasPendingClaim: row.hasPendingClaim,
  };
}

async function loadSortedPlayers(input: {
  season: string;
  scoringPreset?: ScoringPreset;
  scoringRules?: Parameters<typeof getRankedPlayers>[0]["scoringRules"];
}): Promise<RankedPlayerRow[]> {
  const nfl = await getNflState();
  const source = resolvePlayerSearchSource(nfl);
  const season = input.season || nfl.season;

  const load = (kind: "projection" | "stats", week: number) =>
    getRankedPlayers({
      season,
      week,
      kind,
      scoringPreset: input.scoringPreset,
      scoringRules: input.scoringRules,
      limit: SCORE_ROWS_HARD_CAP,
      includePositionRanks: false,
    });

  let rows = await load(source.kind, source.week);
  if (source.kind === "stats" && rows.length === 0) {
    rows = await load("projection", 0);
  }
  return rows;
}

export async function searchPlayersPage(input: {
  season: string;
  query?: string;
  offset?: number;
  limit?: number;
  scoringPreset?: ScoringPreset;
  scoringRules?: Parameters<typeof getRankedPlayers>[0]["scoringRules"];
}): Promise<{
  players: PlayerSearchRow[];
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
  kind: "projection" | "stats";
}> {
  const nfl = await getNflState();
  const source = resolvePlayerSearchSource(nfl);
  const limit = Math.min(
    Math.max(input.limit ?? PLAYER_SEARCH_PAGE_SIZE, 1),
    100,
  );
  const offset = Math.max(input.offset ?? 0, 0);
  const rows = await loadSortedPlayers({
    season: input.season || nfl.season,
    scoringPreset: input.scoringPreset,
    scoringRules: input.scoringRules,
  });

  const normalized = input.query?.trim().toLowerCase() ?? "";
  const filtered = normalized
    ? rows.filter((row) => row.fullName.toLowerCase().includes(normalized))
    : rows;

  const page = filtered.slice(offset, offset + limit).map(toSearchRow);

  return {
    players: page,
    offset,
    limit,
    total: filtered.length,
    hasMore: offset + limit < filtered.length,
    kind: source.kind,
  };
}

export async function searchLeaguePlayersPage(input: {
  slug: string;
  userId: string;
  query?: string;
  offset?: number;
  limit?: number;
}): Promise<
  | {
      ok: true;
      players: PlayerSearchRow[];
      offset: number;
      limit: number;
      total: number;
      hasMore: boolean;
      kind: "projection" | "stats";
      actionsEnabled: boolean;
      tradesEnabled: boolean;
    }
  | { ok: false; status: number; error: string }
> {
  const league = await getLeagueBySlug(input.slug);
  if (!league) {
    return { ok: false, status: 404, error: "League not found." };
  }

  const [membership, season, nfl] = await Promise.all([
    getLeagueMembership(league.id, input.userId),
    getLeagueSeason(league.id),
    getNflState(),
  ]);

  if (!membership) {
    return { ok: false, status: 403, error: "Forbidden." };
  }
  if (!season) {
    return { ok: false, status: 404, error: "Season not found." };
  }

  const scoringPreset = season.scoringPreset as ScoringPreset;
  const scoringRules = resolveScoringRuleDefinitions(
    scoringPreset,
    season.settings.scoringRules,
  );

  const page = await searchPlayersPage({
    season: nfl.season,
    query: input.query,
    offset: input.offset,
    limit: input.limit,
    scoringPreset,
    scoringRules,
  });

  const [ownershipMap, userTeam, draft] = await Promise.all([
    getLeaguePlayerOwnershipMap(season.id, input.userId),
    getUserTeamForSeason(season.id, input.userId),
    getDraftBySeasonId(season.id),
  ]);
  const pendingClaimIds = userTeam
    ? new Set(await getTeamPendingClaimPlayerIds(userTeam.id))
    : new Set<string>();

  const actionsEnabled = isRosterTransactionsEnabled(
    {
      status: season.status,
      freeAgencyOpen: season.freeAgencyOpen,
    },
    draft?.status,
  );
  const wire = resolveWaiverWireSettings(season.settings.waiverWire);

  const players = page.players.map((row) => {
    const ownership = resolvePlayerOwnership(ownershipMap, row.id);
    return {
      ...row,
      fantasyTeamId: ownership.fantasyTeamId,
      fantasyTeamName: ownership.fantasyTeamName,
      fantasyTeamSlug: ownership.fantasyTeamSlug,
      isOwnedByCurrentUser: ownership.isOwnedByCurrentUser,
      onWaivers: ownership.onWaivers,
      acquisitionKind: resolvePlayerAcquisitionKind({
        waiversEnabled: season.waiversEnabled,
        waiverWire: wire,
        rosterTransactionsEnabled: actionsEnabled,
        fantasyTeamId: ownership.fantasyTeamId,
        onWaivers: ownership.onWaivers,
        nflTeam: row.nflTeam,
      }),
      hasPendingClaim: pendingClaimIds.has(row.id),
    };
  });

  return {
    ok: true,
    players,
    offset: page.offset,
    limit: page.limit,
    total: page.total,
    hasMore: page.hasMore,
    kind: page.kind,
    actionsEnabled,
    tradesEnabled: season.tradesEnabled && actionsEnabled,
  };
}
