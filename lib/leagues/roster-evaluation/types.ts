import type { PowerRankingMode } from "@/lib/leagues/power-rankings/types";

export type RosterEvaluationMode = PowerRankingMode;

/** Rank color in a 1..N league field (slate = mid). */
export type RankTone = "success" | "neutral" | "warning" | "destructive";

export type PositionStrengthPoint = {
  position: string;
  /** Radar value 0–100 (rank 1 = 100). Empty cohort → 0. */
  starters: number;
  bench: number;
  /** League rank of starter cohort at this position (1 = best). */
  startersRank: number;
  /** League rank of bench cohort at this position (1 = best). */
  benchRank: number;
  /** False when no players fill starter shells at this position. */
  hasStarters: boolean;
  /** False when no bench players at this position. */
  hasBench: boolean;
};

export type StartingLineupSlot = {
  slotLabel: string;
  playerName: string;
  sleeperId: string | null;
  /** League rank at this slot (1 = best of N teams). */
  rank: number;
  /** 0–100 bar height; rank 1 = 100. */
  powerScore: number;
  tone: RankTone;
};

export type EvaluationRankRow = {
  label: string;
  rank: number;
  rankLabel: string;
  powerScore: number;
  tone: RankTone;
};

export type RosterEvaluationData = {
  /** League size; Starting Lineup Y-axis is 1..teamCount. */
  teamCount: number;
  positionStrength: PositionStrengthPoint[];
  startingLineup: StartingLineupSlot[];
  positionalRankings: EvaluationRankRow[];
  starterRankings: EvaluationRankRow[];
};
