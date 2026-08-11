import "server-only";

import { buildScoreChartSeries, kickoffForNflTeam } from "@/lib/leagues/game-centre/chart";
import {
  computeOptimumLineup,
  type OptimumLineupResult,
} from "@/lib/leagues/game-centre/optimum";
import {
  buildMatchupPreview,
  type GameCentrePreview,
} from "@/lib/leagues/game-centre/preview";
import {
  pickWaiverTips,
  type WaiverTip,
} from "@/lib/leagues/game-centre/waivers";
import {
  buildFilledRosterSections,
  type FilledRosterSlot,
  type TeamRosterPlayer,
} from "@/lib/leagues/roster-fill";
import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring/rules";
import type {
  ScoringPreset,
  ScoringRuleDefinition,
} from "@/lib/leagues/scoring/types";
import {
  matchupWinChance,
  resolveGameProgress,
  type GameProgress,
} from "@/lib/leagues/win-probability";
import type { WinProbPlayer } from "@/lib/leagues/win-probability/expected-points";
import {
  getStartedNflTeamAbbreviations,
  hasNflTeamStarted,
} from "@/lib/leagues/waivers/game-lock";
import { getNflScoreboard, type ScheduleGame } from "@/lib/espn/scoreboard";
import {
  espnSeasonTypeForNfl,
  fantasyWeekToNfl,
} from "@/lib/leagues/schedule/fantasy-week-map";
import {
  buildOpponentByTeam,
  normalizeNflTeamAbbrev,
  resolvePlayerOpponent,
  type PlayerOpponent,
  type TeamMatchup,
} from "@/lib/nfl/matchups";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeasonByYear,
} from "@/lib/queries/leagues";
import { getMatchupByKey, getTeamSchedule } from "@/lib/queries/matchups";
import { getRankedPlayers, type RankedPlayerRow } from "@/lib/queries/players";
import {
  getLeaguePlayerOwnershipMap,
} from "@/lib/queries/roster";
import { getTeamRosterPlayers } from "@/lib/queries/team-roster";
import { getUserTeamForSeason } from "@/lib/queries/watchlist";
import {
  clientStatAllowlist,
  pickClientStats,
} from "@/lib/rankings/pick-client-stats";

const GAME_CENTRE_STAT_ALLOWLIST = clientStatAllowlist();

export type GameCentrePlayer = {
  id: string;
  fullName: string;
  nflTeam: string | null;
  primaryPositionId: string;
  injuryStatus: string | null;
  sleeperId: string | null;
  slotPositionId: string;
  projectedPts: number | null;
  actualPts: number | null;
  /** 0–1 fill for actual vs projected progress bar. */
  progressRatio: number | null;
  opponent: PlayerOpponent | null;
  kickoff: string | null;
  gameStatus: ScheduleGame["status"] | null;
  locked: boolean;
  /** Trimmed actual week stats for box score + client-side breakdown. */
  stats: Record<string, number | null>;
};

export type GameCentreDuelRow = {
  slotPositionId: string;
  away: GameCentrePlayer | null;
  home: GameCentrePlayer | null;
  /** Side with higher projected pts; null on tie (empty = 0). */
  adv: "away" | "home" | null;
};

export type GameCentreYetToPlayPlayer = {
  id: string;
  fullName: string;
  slotPositionId: string;
  opponentLabel: string | null;
  kickoff: string | null;
};

export type GameCentreTeamSide = {
  teamId: string;
  teamName: string;
  teamSlug: string;
  logoUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  winChance: number | null;
  projectedPts: number | null;
  actualPts: number | null;
  isLoser: boolean;
  isViewerTeam: boolean;
  /** Starters whose NFL game has not started yet. */
  yetToPlay: number;
  yetToPlayPlayers: GameCentreYetToPlayPlayer[];
};

export type GameCentreBoxTeam = {
  teamId: string;
  teamName: string;
  starters: GameCentrePlayer[];
};

export type GameCentreChartPoint = {
  at: string;
  label: string;
  away: number;
  home: number;
};

export type GameCentreData = {
  matchupId: string;
  /** Short URL segment; preferred over matchupId in links. */
  matchupPublicId: string;
  week: number;
  seasonYear: number;
  regularSeasonEndWeek: number;
  scheduleSettings: import("@/db/schema/league-seasons").ScheduleSettings | null;
  leagueSlug: string;
  status: "scheduled" | "in_progress" | "final";
  finalizedAt: string | null;
  /** League scoring rules for client-side breakdown dialog. */
  scoringRules: ScoringRuleDefinition[];
  away: GameCentreTeamSide;
  home: GameCentreTeamSide;
  duelRows: GameCentreDuelRow[];
  benchRows: GameCentreDuelRow[];
  chart: GameCentreChartPoint[];
  chartEmpty: boolean;
  optimum: OptimumLineupResult | null;
  waiverTips: WaiverTip[];
  boxScore: {
    away: GameCentreBoxTeam;
    home: GameCentreBoxTeam;
  };
  viewerTeamId: string | null;
  /** Pre-game insight dashboard; only populated when status is scheduled. */
  preview: GameCentrePreview | null;
};

function buildProgressByNflTeam(
  games: ScheduleGame[],
): Map<string, GameProgress> {
  const map = new Map<string, GameProgress>();
  for (const game of games) {
    const progress = resolveGameProgress({
      status: game.status,
      period: game.period,
      displayClock: game.displayClock,
    });
    const home = normalizeNflTeamAbbrev(game.home.abbreviation);
    const away = normalizeNflTeamAbbrev(game.away.abbreviation);
    if (home) map.set(home, progress);
    if (away) map.set(away, progress);
  }
  return map;
}

function toWinProbPlayers(
  slots: FilledRosterSlot[],
  projectedById: Map<string, number | null>,
  actualById: Map<string, number | null>,
): WinProbPlayer[] {
  return slots
    .map((slot) => slot.player)
    .filter((player): player is TeamRosterPlayer => player != null)
    .map((player) => ({
      id: player.id,
      primaryPositionId: player.primaryPositionId,
      nflTeam: player.nflTeam,
      projectedPts: projectedById.get(player.id) ?? null,
      actualPts: actualById.get(player.id) ?? null,
      injuryStatus: player.injuryStatus,
    }));
}

function progressRatio(
  actual: number | null,
  projected: number | null,
  started: boolean,
): number | null {
  if (!started) return null;
  if (projected == null || projected <= 0) {
    return actual != null && actual > 0 ? 1 : 0;
  }
  if (actual == null) return 0;
  return Math.max(0, Math.min(1, actual / projected));
}

function mapPlayer(input: {
  player: TeamRosterPlayer;
  slotPositionId: string;
  projectedById: Map<string, number | null>;
  actualById: Map<string, number | null>;
  actualStatsById: Map<string, RankedPlayerRow>;
  opponentsByTeam: Map<string, TeamMatchup>;
  week: number;
  seasonYear: number;
  startedTeams: Set<string>;
  games: ScheduleGame[];
}): GameCentrePlayer {
  const {
    player,
    slotPositionId,
    projectedById,
    actualById,
    actualStatsById,
    opponentsByTeam,
    week,
    seasonYear,
    startedTeams,
    games,
  } = input;

  const projectedPts = projectedById.get(player.id) ?? null;
  const actualPts = actualById.get(player.id) ?? null;
  const opponent = resolvePlayerOpponent({
    nflTeam: player.nflTeam,
    byeWeek: player.byeWeek,
    week,
    opponentsByTeam,
    seasonYear,
  });
  const kickoff = kickoffForNflTeam(player.nflTeam, games);
  const teamMatchup = player.nflTeam
    ? opponentsByTeam.get(normalizeNflTeamAbbrev(player.nflTeam) ?? "")
    : undefined;
  const gameStatus = teamMatchup?.gameStatus ?? opponent?.gameStatus ?? null;
  const locked = hasNflTeamStarted(player.nflTeam, startedTeams);
  const started = locked;
  const actualRow = actualStatsById.get(player.id);
  // Box score uses actual week stats only — never projections.
  const stats = pickClientStats(
    actualRow?.stats ?? {},
    GAME_CENTRE_STAT_ALLOWLIST,
  );

  return {
    id: player.id,
    fullName: player.fullName,
    nflTeam: player.nflTeam,
    primaryPositionId: player.primaryPositionId,
    injuryStatus: player.injuryStatus,
    sleeperId: player.sleeperId,
    slotPositionId,
    projectedPts,
    actualPts: started ? (actualPts ?? 0) : null,
    progressRatio: progressRatio(actualPts, projectedPts, started),
    opponent,
    kickoff,
    gameStatus,
    locked,
    stats,
  };
}

function mapSlots(
  slots: FilledRosterSlot[],
  ctx: Omit<Parameters<typeof mapPlayer>[0], "player" | "slotPositionId">,
): Array<GameCentrePlayer | null> {
  return slots.map((slot) => {
    if (!slot.player) return null;
    return mapPlayer({
      ...ctx,
      player: slot.player,
      slotPositionId: slot.slotPositionId,
    });
  });
}

function sumPts(players: Array<GameCentrePlayer | null>, key: "projectedPts" | "actualPts") {
  let total = 0;
  let any = false;
  for (const player of players) {
    if (!player) continue;
    const value = player[key];
    if (value == null) continue;
    total += value;
    any = true;
  }
  return any ? Math.round(total * 100) / 100 : null;
}

/** Empty / missing projection counts as 0; ADV = higher projected pts. */
function resolveAdv(
  awayProjected: number | null | undefined,
  homeProjected: number | null | undefined,
): "away" | "home" | null {
  const awayPts = awayProjected ?? 0;
  const homePts = homeProjected ?? 0;
  if (awayPts > homePts) return "away";
  if (homePts > awayPts) return "home";
  return null;
}

export async function getGameCentreData(input: {
  matchupId: string;
  leagueSlug: string;
  userId: string;
}): Promise<GameCentreData | null> {
  const league = await getLeagueBySlug(input.leagueSlug);
  if (!league) return null;

  const [membership, matchup] = await Promise.all([
    getLeagueMembership(league.id, input.userId),
    getMatchupByKey({
      leagueId: league.id,
      matchupKey: input.matchupId,
    }),
  ]);
  if (!membership || !matchup) return null;

  const season = await getLeagueSeasonByYear(league.id, matchup.seasonYear);
  if (!season) return null;

  const scoringPreset = season.scoringPreset as ScoringPreset;
  const scoringRules = resolveScoringRuleDefinitions(
    scoringPreset,
    season.settings.scoringRules,
  );
  const nflPoint = fantasyWeekToNfl(matchup.week, season.settings.schedule);
  const scoringWeek = nflPoint?.week ?? matchup.week;
  const scoringSeasonType = nflPoint?.seasonType ?? "regular";

  const [awayRoster, homeRoster, viewerTeam, ownership, scoreboard] =
    await Promise.all([
      getTeamRosterPlayers(matchup.awayTeamId),
      getTeamRosterPlayers(matchup.homeTeamId),
      getUserTeamForSeason(season.id, input.userId),
      getLeaguePlayerOwnershipMap(season.id, input.userId).catch(
        () => new Map(),
      ),
      getNflScoreboard({
        season: season.seasonYear,
        week: scoringWeek,
        seasonType: espnSeasonTypeForNfl(scoringSeasonType),
      }).catch(() => null),
    ]);

  const games = scoreboard?.games ?? [];
  const opponentsByTeam = buildOpponentByTeam(games);
  const startedTeams = getStartedNflTeamAbbreviations(games);
  const progressByNflTeam = buildProgressByNflTeam(games);

  const fillInput = {
    rosterSlots: season.settings.rosterSlots,
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    irSlots: season.irSlots,
    taxiEnabled: season.taxiEnabled,
    taxiSlots: season.taxiSlots,
    irEligibleStatuses: season.settings.irEligibleStatuses,
  };

  const awaySections = buildFilledRosterSections({
    ...fillInput,
    players: awayRoster,
  });
  const homeSections = buildFilledRosterSections({
    ...fillInput,
    players: homeRoster,
  });

  const rosterIds = [
    ...new Set([...awayRoster, ...homeRoster].map((p) => p.id)),
  ];
  const viewerTeamId = viewerTeam?.id ?? null;
  const needsFaTips =
    viewerTeamId != null &&
    (viewerTeamId === matchup.awayTeamId ||
      viewerTeamId === matchup.homeTeamId);

  const seasonYear = String(season.seasonYear);
  const needsPreview = matchup.status === "scheduled";

  const [weekProjections, weekStats, faProjections, awaySchedule, seasonProjections] =
    await Promise.all([
      rosterIds.length
        ? getRankedPlayers({
            season: seasonYear,
            week: scoringWeek,
            seasonType: scoringSeasonType,
            kind: "projection",
            scoringRules,
            playerIds: rosterIds,
            preserveStats: true,
          }).catch(() => [])
        : Promise.resolve([]),
      rosterIds.length
        ? getRankedPlayers({
            season: seasonYear,
            week: scoringWeek,
            seasonType: scoringSeasonType,
            kind: "stats",
            scoringRules,
            playerIds: rosterIds,
            preserveStats: true,
          }).catch(() => [])
        : Promise.resolve([]),
      // Waiver tips only for the viewer's matchup; top projections (not full pool).
      needsFaTips
        ? getRankedPlayers({
            season: seasonYear,
            week: scoringWeek,
            seasonType: scoringSeasonType,
            kind: "projection",
            scoringRules,
            limit: 100,
          }).catch(() => [])
        : Promise.resolve([]),
      needsPreview
        ? getTeamSchedule(season.id, matchup.awayTeamId)
        : Promise.resolve([]),
      needsPreview && rosterIds.length
        ? getRankedPlayers({
            season: seasonYear,
            week: 0,
            kind: "projection",
            scoringRules,
            playerIds: rosterIds,
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

  const projectedById = new Map(
    weekProjections.map((p) => [p.id, p.fantasyPts]),
  );
  const seasonProjectedById = new Map(
    seasonProjections.map((p) => [p.id, p.fantasyPts]),
  );
  const actualById = new Map(weekStats.map((p) => [p.id, p.fantasyPts]));
  const actualStatsById = new Map(weekStats.map((p) => [p.id, p]));

  const playerCtx = {
    projectedById,
    actualById,
    actualStatsById,
    opponentsByTeam,
    week: matchup.week,
    seasonYear: season.seasonYear,
    startedTeams,
    games,
  };

  const awayStarters = mapSlots(awaySections.lineup, playerCtx);
  const homeStarters = mapSlots(homeSections.lineup, playerCtx);
  const awayBench = mapSlots(awaySections.bench, playerCtx).filter(
    (p): p is GameCentrePlayer => p != null,
  );
  const homeBench = mapSlots(homeSections.bench, playerCtx).filter(
    (p): p is GameCentrePlayer => p != null,
  );

  const maxSlots = Math.max(
    awaySections.lineup.length,
    homeSections.lineup.length,
  );
  const duelRows: GameCentreDuelRow[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const slotPositionId =
      awaySections.lineup[i]?.slotPositionId ??
      homeSections.lineup[i]?.slotPositionId ??
      "FLEX";
    const away = awayStarters[i] ?? null;
    const home = homeStarters[i] ?? null;
    duelRows.push({
      slotPositionId,
      away,
      home,
      adv: resolveAdv(away?.projectedPts, home?.projectedPts),
    });
  }

  const maxBench = Math.max(awayBench.length, homeBench.length);
  const benchRows: GameCentreDuelRow[] = [];
  for (let i = 0; i < maxBench; i++) {
    const away = awayBench[i] ?? null;
    const home = homeBench[i] ?? null;
    benchRows.push({
      slotPositionId: away?.slotPositionId ?? home?.slotPositionId ?? "BN",
      away,
      home,
      adv: resolveAdv(away?.projectedPts, home?.projectedPts),
    });
  }

  function countYetToPlay(players: Array<GameCentrePlayer | null>) {
    return players.filter(
      (player) => player != null && !player.locked,
    ).length;
  }

  function yetToPlayBreakdown(
    players: Array<GameCentrePlayer | null>,
  ): GameCentreYetToPlayPlayer[] {
    return players
      .filter((player): player is GameCentrePlayer => player != null && !player.locked)
      .map((player) => ({
        id: player.id,
        fullName: player.fullName,
        slotPositionId: player.slotPositionId,
        opponentLabel: player.opponent?.label ?? null,
        kickoff: player.kickoff,
      }));
  }

  const awayWinPlayers = toWinProbPlayers(
    awaySections.lineup,
    projectedById,
    actualById,
  );
  const homeWinPlayers = toWinProbPlayers(
    homeSections.lineup,
    projectedById,
    actualById,
  );
  const chance =
    awayWinPlayers.length === 0 && homeWinPlayers.length === 0
      ? null
      : matchupWinChance({
          focusStarters: awayWinPlayers,
          opponentStarters: homeWinPlayers,
          progressByNflTeam,
        });

  const awayProjected = sumPts(awayStarters, "projectedPts");
  const homeProjected = sumPts(homeStarters, "projectedPts");
  const awayActual = sumPts(awayStarters, "actualPts");
  const homeActual = sumPts(homeStarters, "actualPts");

  const allFinal =
    [...awayStarters, ...homeStarters].every(
      (p) => !p || p.gameStatus === "post" || p.opponent?.gameStatus === null,
    ) &&
    (awayActual != null || homeActual != null);

  let awayLoser = false;
  let homeLoser = false;
  if (
    allFinal &&
    awayActual != null &&
    homeActual != null &&
    Math.abs(awayActual - homeActual) > 0.05
  ) {
    if (awayActual < homeActual) awayLoser = true;
    else homeLoser = true;
  }

  const awayIsViewer = viewerTeamId != null && viewerTeamId === matchup.awayTeamId;
  const homeIsViewer = viewerTeamId != null && viewerTeamId === matchup.homeTeamId;

  const chartStarters = (players: Array<GameCentrePlayer | null>) =>
    players
      .filter((p): p is GameCentrePlayer => p != null)
      .map((p) => ({
        nflTeam: p.nflTeam,
        actualPts: p.actualPts,
        kickoff: p.kickoff,
        gameStatus: p.gameStatus,
      }));

  const chart = buildScoreChartSeries({
    awayStarters: chartStarters(awayStarters),
    homeStarters: chartStarters(homeStarters),
  });
  const chartEmpty = chart.every((p) => p.away === 0 && p.home === 0);

  let optimum: OptimumLineupResult | null = null;
  let waiverTips: WaiverTip[] = [];

  if (viewerTeamId && (awayIsViewer || homeIsViewer)) {
    const viewerRoster = awayIsViewer ? awayRoster : homeRoster;
    const viewerLineup = awayIsViewer
      ? awaySections.lineup
      : homeSections.lineup;

    optimum = computeOptimumLineup({
      lineup: viewerLineup,
      rosterPlayers: viewerRoster,
      projectedById,
      startedTeams,
      irEligibleStatuses: season.settings.irEligibleStatuses,
    });

    waiverTips = pickWaiverTips({
      projections: faProjections,
      ownership,
      lineup: viewerLineup,
      projectedById,
      irEligibleStatuses: season.settings.irEligibleStatuses,
      limit: 3,
    });
  }

  const awaySide: GameCentreTeamSide = {
    teamId: matchup.awayTeamId,
    teamName: matchup.awayTeamName,
    teamSlug: matchup.awayTeamSlug,
    logoUrl: matchup.awayTeamLogoUrl,
    wins: 0,
    losses: 0,
    ties: 0,
    winChance: chance?.winProbability ?? null,
    projectedPts: awayProjected,
    actualPts: awayActual,
    isLoser: awayLoser,
    isViewerTeam: awayIsViewer,
    yetToPlay: countYetToPlay(awayStarters),
    yetToPlayPlayers: yetToPlayBreakdown(awayStarters),
  };

  const homeSide: GameCentreTeamSide = {
    teamId: matchup.homeTeamId,
    teamName: matchup.homeTeamName,
    teamSlug: matchup.homeTeamSlug,
    logoUrl: matchup.homeTeamLogoUrl,
    wins: 0,
    losses: 0,
    ties: 0,
    winChance: chance ? 1 - chance.winProbability : null,
    projectedPts: homeProjected,
    actualPts: homeActual,
    isLoser: homeLoser,
    isViewerTeam: homeIsViewer,
    yetToPlay: countYetToPlay(homeStarters),
    yetToPlayPlayers: yetToPlayBreakdown(homeStarters),
  };

  const awayStarterIds = new Set(
    awayStarters.filter((p): p is GameCentrePlayer => p != null).map((p) => p.id),
  );
  const homeStarterIds = new Set(
    homeStarters.filter((p): p is GameCentrePlayer => p != null).map((p) => p.id),
  );

  const preview = needsPreview
    ? buildMatchupPreview({
        focusSchedule: awaySchedule,
        opponentTeamId: matchup.homeTeamId,
        seasonYear: season.seasonYear,
        awayPlayers: awayRoster.map((player) => ({
          id: player.id,
          fullName: player.fullName,
          primaryPositionId: player.primaryPositionId,
          sleeperId: player.sleeperId,
          nflTeam: player.nflTeam,
          injuryStatus: player.injuryStatus,
          projectedPts: projectedById.get(player.id) ?? null,
          seasonProjectedPts: seasonProjectedById.get(player.id) ?? null,
          isStarter: awayStarterIds.has(player.id),
        })),
        homePlayers: homeRoster.map((player) => ({
          id: player.id,
          fullName: player.fullName,
          primaryPositionId: player.primaryPositionId,
          sleeperId: player.sleeperId,
          nflTeam: player.nflTeam,
          injuryStatus: player.injuryStatus,
          projectedPts: projectedById.get(player.id) ?? null,
          seasonProjectedPts: seasonProjectedById.get(player.id) ?? null,
          isStarter: homeStarterIds.has(player.id),
        })),
      })
    : null;

  return {
    matchupId: matchup.id,
    matchupPublicId: matchup.publicId,
    week: matchup.week,
    seasonYear: matchup.seasonYear,
    regularSeasonEndWeek: season.regularSeasonEndWeek,
    scheduleSettings: season.settings.schedule ?? null,
    leagueSlug: input.leagueSlug,
    status: matchup.status,
    finalizedAt: matchup.finalizedAt?.toISOString() ?? null,
    scoringRules,
    away: awaySide,
    home: homeSide,
    duelRows,
    benchRows,
    chart,
    chartEmpty,
    optimum,
    waiverTips,
    boxScore: {
      away: {
        teamId: matchup.awayTeamId,
        teamName: matchup.awayTeamName,
        starters: awayStarters.filter((p): p is GameCentrePlayer => p != null),
      },
      home: {
        teamId: matchup.homeTeamId,
        teamName: matchup.homeTeamName,
        starters: homeStarters.filter((p): p is GameCentrePlayer => p != null),
      },
    },
    viewerTeamId,
    preview,
  };
}
