import {
  scalePowerScoresToBarometer,
} from "@/lib/leagues/power-rankings/types";
import {
  formatOrdinalRank,
  rankPowerScore,
  rankTone,
} from "@/lib/leagues/roster-evaluation/rank";
import type {
  EvaluationRankRow,
  PositionStrengthPoint,
  RosterEvaluationData,
  RosterEvaluationMode,
  StartingLineupSlot,
} from "@/lib/leagues/roster-evaluation/types";

function rowsFromRanks(
  entries: Array<{ label: string; rank: number }>,
  teamCount = 12,
): EvaluationRankRow[] {
  const raw = new Map(
    entries.map((entry) => [
      entry.label,
      Math.max(1, teamCount + 1 - entry.rank),
    ]),
  );
  const scores = scalePowerScoresToBarometer(raw);
  return entries.map((entry) => {
    const powerScore = scores.get(entry.label) ?? 0;
    return {
      label: entry.label,
      rank: entry.rank,
      rankLabel: formatOrdinalRank(entry.rank),
      powerScore,
      tone: rankTone(entry.rank, teamCount),
    };
  });
}

function lineupFromSlots(
  slots: Array<{
    slotLabel: string;
    playerName: string;
    sleeperId: string | null;
    rank: number;
  }>,
  teamCount = 12,
): StartingLineupSlot[] {
  const raw = new Map(
    slots.map((slot) => [
      slot.slotLabel,
      Math.max(1, teamCount + 1 - slot.rank),
    ]),
  );
  const scores = scalePowerScoresToBarometer(raw);
  return slots.map((slot) => {
    const powerScore = scores.get(slot.slotLabel) ?? 0;
    return {
      ...slot,
      powerScore,
      tone: rankTone(slot.rank, teamCount),
    };
  });
}

function radarFromRanks(
  entries: Array<{ position: string; startersRank: number; benchRank: number }>,
  teamCount = 4,
): PositionStrengthPoint[] {
  return entries.map((entry) => ({
    position: entry.position,
    startersRank: entry.startersRank,
    benchRank: entry.benchRank,
    starters: rankPowerScore(entry.startersRank, teamCount),
    bench: rankPowerScore(entry.benchRank, teamCount),
  }));
}

/**
 * Placeholder evaluation payload until projection-backed rankings ship.
 * Mode is accepted for API stability. Starting Lineup is replaced by the
 * live query when available.
 */
export function buildScaffoldRosterEvaluation(
  _mode: RosterEvaluationMode = "draft",
): RosterEvaluationData {
  void _mode;

  return {
    teamCount: 4,
    positionStrength: radarFromRanks([
      { position: "QB", startersRank: 1, benchRank: 3 },
      { position: "RB", startersRank: 2, benchRank: 2 },
      { position: "WR", startersRank: 1, benchRank: 2 },
      { position: "TE", startersRank: 3, benchRank: 4 },
      { position: "FLEX", startersRank: 2, benchRank: 3 },
      { position: "K", startersRank: 4, benchRank: 4 },
    ]),
    startingLineup: lineupFromSlots([
      { slotLabel: "QB", playerName: "Josh Allen", sleeperId: "4984", rank: 3 },
      { slotLabel: "RB1", playerName: "Bijan Robinson", sleeperId: "9509", rank: 1 },
      { slotLabel: "RB2", playerName: "Breece Hall", sleeperId: "8155", rank: 2 },
      { slotLabel: "WR1", playerName: "CeeDee Lamb", sleeperId: "6786", rank: 2 },
      { slotLabel: "WR2", playerName: "Amon-Ra St. Brown", sleeperId: "8137", rank: 1 },
      { slotLabel: "TE", playerName: "Sam LaPorta", sleeperId: "8221", rank: 4 },
      { slotLabel: "FLX", playerName: "James Cook", sleeperId: "8138", rank: 3 },
      { slotLabel: "K", playerName: "Brandon Aubrey", sleeperId: "11566", rank: 2 },
    ], 4),
    positionalRankings: rowsFromRanks(
      [
        { label: "QB", rank: 3 },
        { label: "RB", rank: 2 },
        { label: "WR", rank: 1 },
        { label: "TE", rank: 4 },
        { label: "FLEX", rank: 2 },
        { label: "K", rank: 3 },
        { label: "STARTERS", rank: 2 },
        { label: "BENCH", rank: 3 },
      ],
      4,
    ),
    starterRankings: rowsFromRanks(
      [
        { label: "QB", rank: 3 },
        { label: "RB1", rank: 1 },
        { label: "RB2", rank: 2 },
        { label: "WR1", rank: 2 },
        { label: "WR2", rank: 1 },
        { label: "TE", rank: 4 },
        { label: "FLX", rank: 3 },
        { label: "K", rank: 2 },
      ],
      4,
    ),
  };
}
