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

/** Throwaway 4-team league mock — remove when live eval is trusted. */
const TEAM_COUNT = 4;

function rowsFromRanks(
  entries: Array<{ label: string; rank: number }>,
): EvaluationRankRow[] {
  const raw = new Map(
    entries.map((entry) => [
      entry.label,
      Math.max(1, TEAM_COUNT + 1 - entry.rank),
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
      tone: rankTone(entry.rank, TEAM_COUNT),
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
): StartingLineupSlot[] {
  return slots.map((slot) => ({
    ...slot,
    powerScore: Math.round(
      (100 * (TEAM_COUNT - slot.rank + 1)) / TEAM_COUNT,
    ),
    tone: rankTone(slot.rank, TEAM_COUNT),
  }));
}

function radarFromRanks(
  entries: Array<{ position: string; startersRank: number; benchRank: number }>,
): PositionStrengthPoint[] {
  return entries.map((entry) => ({
    position: entry.position,
    startersRank: entry.startersRank,
    benchRank: entry.benchRank,
    starters: rankPowerScore(entry.startersRank, TEAM_COUNT),
    bench: rankPowerScore(entry.benchRank, TEAM_COUNT),
    hasStarters: true,
    hasBench: true,
  }));
}

/**
 * Dev-only mock (`?mock=1`) with intentionally different current vs optimal
 * vs positional rows so the three cards are easy to tell apart.
 */
export function getRosterEvaluationByModeMock(): Record<
  RosterEvaluationMode,
  RosterEvaluationData
> {
  const positionStrength = radarFromRanks([
    { position: "QB", startersRank: 1, benchRank: 3 },
    { position: "RB", startersRank: 1, benchRank: 2 },
    { position: "WR", startersRank: 2, benchRank: 2 },
    { position: "TE", startersRank: 4, benchRank: 4 },
    { position: "CB", startersRank: 2, benchRank: 3 },
    { position: "S", startersRank: 1, benchRank: 4 },
    { position: "DT", startersRank: 3, benchRank: 3 },
    { position: "DE", startersRank: 2, benchRank: 2 },
    { position: "LB", startersRank: 1, benchRank: 2 },
    { position: "K", startersRank: 2, benchRank: 4 },
  ]);

  // Current lineup: weaker RB2 / TE / FLX (what you actually started)
  const currentLineup = lineupFromSlots([
    { slotLabel: "QB", playerName: "Josh Allen", sleeperId: "4984", rank: 1 },
    {
      slotLabel: "RB1",
      playerName: "Bijan Robinson",
      sleeperId: "9509",
      rank: 1,
    },
    {
      slotLabel: "RB2",
      playerName: "Rachaad White",
      sleeperId: "8150",
      rank: 4,
    },
    {
      slotLabel: "WR1",
      playerName: "CeeDee Lamb",
      sleeperId: "6786",
      rank: 2,
    },
    {
      slotLabel: "WR2",
      playerName: "Courtland Sutton",
      sleeperId: "5045",
      rank: 3,
    },
    {
      slotLabel: "TE",
      playerName: "Jake Ferguson",
      sleeperId: "8110",
      rank: 4,
    },
    {
      slotLabel: "FLX",
      playerName: "Romeo Doubs",
      sleeperId: "8160",
      rank: 3,
    },
    {
      slotLabel: "K",
      playerName: "Brandon Aubrey",
      sleeperId: "11566",
      rank: 2,
    },
  ]);

  // Optimal: upgrades RB2 / WR2 / TE / FLX — ranks should look stronger
  const optimalStarterRows = rowsFromRanks([
    { label: "QB", rank: 1 },
    { label: "RB1", rank: 1 },
    { label: "RB2", rank: 2 },
    { label: "WR1", rank: 2 },
    { label: "WR2", rank: 1 },
    { label: "TE", rank: 2 },
    { label: "FLX", rank: 1 },
    { label: "K", rank: 2 },
  ]);

  const positional = rowsFromRanks([
    { label: "QB", rank: 2 },
    { label: "RB", rank: 1 },
    { label: "WR", rank: 3 },
    { label: "TE", rank: 4 },
    { label: "K", rank: 2 },
  ]);

  const base: RosterEvaluationData = {
    teamCount: TEAM_COUNT,
    positionStrength,
    startingLineup: currentLineup,
    starterRankings: optimalStarterRows,
    positionalRankings: positional,
  };

  // Week mode: nudge a few ranks so the select change is obvious
  const week: RosterEvaluationData = {
    teamCount: TEAM_COUNT,
    positionStrength: radarFromRanks([
      { position: "QB", startersRank: 1, benchRank: 2 },
      { position: "RB", startersRank: 1, benchRank: 1 },
      { position: "WR", startersRank: 1, benchRank: 2 },
      { position: "TE", startersRank: 3, benchRank: 3 },
      { position: "K", startersRank: 1, benchRank: 3 },
    ]),
    startingLineup: lineupFromSlots(
      currentLineup.map((slot) => ({
        slotLabel: slot.slotLabel,
        playerName: slot.playerName,
        sleeperId: slot.sleeperId,
        rank: Math.max(1, slot.rank - (slot.slotLabel === "WR2" ? 1 : 0)),
      })),
    ),
    starterRankings: rowsFromRanks([
      { label: "QB", rank: 1 },
      { label: "RB1", rank: 1 },
      { label: "RB2", rank: 1 },
      { label: "WR1", rank: 2 },
      { label: "WR2", rank: 1 },
      { label: "TE", rank: 3 },
      { label: "FLX", rank: 2 },
      { label: "K", rank: 1 },
    ]),
    positionalRankings: rowsFromRanks([
      { label: "QB", rank: 1 },
      { label: "RB", rank: 1 },
      { label: "WR", rank: 2 },
      { label: "TE", rank: 3 },
      { label: "K", rank: 1 },
    ]),
  };

  const ros: RosterEvaluationData = {
    ...base,
    positionalRankings: rowsFromRanks([
      { label: "QB", rank: 1 },
      { label: "RB", rank: 2 },
      { label: "WR", rank: 2 },
      { label: "TE", rank: 3 },
      { label: "K", rank: 3 },
    ]),
  };

  return {
    draft: base,
    week,
    "rest-of-season": ros,
  };
}
