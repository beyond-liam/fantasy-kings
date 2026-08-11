import type { MatchupBoardGame } from "@/lib/queries/week-matchup-board";

export type MatchupBoardLiveSidePatch = {
  actualPts: number | null;
  projectedPts: number | null;
  winChance: number | null;
  isLoser: boolean;
};

export type MatchupBoardLiveGamePatch = {
  id: string;
  status: MatchupBoardGame["status"];
  resultFinal: boolean;
  away: MatchupBoardLiveSidePatch;
  home: MatchupBoardLiveSidePatch;
};

export type MatchupBoardLivePatch = {
  updatedAt: string | null;
  week: number;
  hasLiveNflGames: boolean;
  games: MatchupBoardLiveGamePatch[];
};
