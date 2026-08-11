import type { ScheduleGame } from "@/lib/espn/scoreboard";
import type {
  GameCentreChartPoint,
  GameCentreData,
  GameCentrePlayer,
  GameCentreYetToPlayPlayer,
} from "@/lib/queries/game-centre";

export type GameCentreLivePlayerPatch = {
  id: string;
  actualPts: number | null;
  projectedPts: number | null;
  progressRatio: number | null;
  gameStatus: ScheduleGame["status"] | null;
  locked: boolean;
  stats: Record<string, number | null>;
};

export type GameCentreLiveSidePatch = {
  actualPts: number | null;
  projectedPts: number | null;
  winChance: number | null;
  isLoser: boolean;
  yetToPlay: number;
  yetToPlayPlayers: GameCentreYetToPlayPlayer[];
};

export type GameCentreLivePatch = {
  updatedAt: string | null;
  week: number;
  hasLiveNflGames: boolean;
  matchupId: string;
  matchupPublicId: string;
  status: GameCentreData["status"];
  away: GameCentreLiveSidePatch;
  home: GameCentreLiveSidePatch;
  players: GameCentreLivePlayerPatch[];
  chart: GameCentreChartPoint[];
  chartEmpty: boolean;
};

function toPlayerPatch(player: GameCentrePlayer): GameCentreLivePlayerPatch {
  return {
    id: player.id,
    actualPts: player.actualPts,
    projectedPts: player.projectedPts,
    progressRatio: player.progressRatio,
    gameStatus: player.gameStatus,
    locked: player.locked,
    stats: player.stats,
  };
}

function toSidePatch(side: GameCentreData["away"]): GameCentreLiveSidePatch {
  return {
    actualPts: side.actualPts,
    projectedPts: side.projectedPts,
    winChance: side.winChance,
    isLoser: side.isLoser,
    yetToPlay: side.yetToPlay,
    yetToPlayPlayers: side.yetToPlayPlayers,
  };
}

function mergePlayer(
  player: GameCentrePlayer | null,
  byId: Map<string, GameCentreLivePlayerPatch>,
): GameCentrePlayer | null {
  if (!player) return null;
  const patch = byId.get(player.id);
  if (!patch) return player;
  return {
    ...player,
    actualPts: patch.actualPts,
    projectedPts: patch.projectedPts,
    progressRatio: patch.progressRatio,
    gameStatus: patch.gameStatus,
    locked: patch.locked,
    stats: patch.stats,
  };
}

/** Build a slim live patch from a (liveOnly) Game Centre payload. */
export function toGameCentreLivePatch(input: {
  data: GameCentreData;
  updatedAt: string | null;
  hasLiveNflGames: boolean;
}): GameCentreLivePatch {
  const { data } = input;
  const byId = new Map<string, GameCentreLivePlayerPatch>();

  const add = (player: GameCentrePlayer | null) => {
    if (!player) return;
    byId.set(player.id, toPlayerPatch(player));
  };

  for (const row of data.duelRows) {
    add(row.away);
    add(row.home);
  }
  for (const row of data.benchRows) {
    add(row.away);
    add(row.home);
  }
  for (const player of data.boxScore.away.starters) {
    add(player);
  }
  for (const player of data.boxScore.home.starters) {
    add(player);
  }

  return {
    updatedAt: input.updatedAt,
    week: data.week,
    hasLiveNflGames: input.hasLiveNflGames,
    matchupId: data.matchupId,
    matchupPublicId: data.matchupPublicId,
    status: data.status,
    away: toSidePatch(data.away),
    home: toSidePatch(data.home),
    players: [...byId.values()],
    chart: data.chart,
    chartEmpty: data.chartEmpty,
  };
}

/** Merge a live patch into existing Game Centre client state. */
export function applyGameCentrePatch(
  prev: GameCentreData,
  patch: GameCentreLivePatch,
): GameCentreData {
  if (
    patch.matchupId !== prev.matchupId &&
    patch.matchupPublicId !== prev.matchupPublicId
  ) {
    return prev;
  }

  const byId = new Map(patch.players.map((player) => [player.id, player]));

  const duelRows = prev.duelRows.map((row) => ({
    ...row,
    away: mergePlayer(row.away, byId),
    home: mergePlayer(row.home, byId),
  }));
  const benchRows = prev.benchRows.map((row) => ({
    ...row,
    away: mergePlayer(row.away, byId),
    home: mergePlayer(row.home, byId),
  }));

  return {
    ...prev,
    status: patch.status,
    away: {
      ...prev.away,
      ...patch.away,
    },
    home: {
      ...prev.home,
      ...patch.home,
    },
    duelRows,
    benchRows,
    chart: patch.chart,
    chartEmpty: patch.chartEmpty,
    boxScore: {
      away: {
        ...prev.boxScore.away,
        starters: prev.boxScore.away.starters.map(
          (player) => mergePlayer(player, byId) ?? player,
        ),
      },
      home: {
        ...prev.boxScore.home,
        starters: prev.boxScore.home.starters.map(
          (player) => mergePlayer(player, byId) ?? player,
        ),
      },
    },
  };
}
