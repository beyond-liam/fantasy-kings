import { z } from "zod";

import type {
  GameTiebreakerId,
  RankTiebreakerId,
  TiebreakerSettings,
} from "@/db/schema/league-seasons";

export type { GameTiebreakerId, RankTiebreakerId, TiebreakerSettings };

export const GAME_TIEBREAKER_OPTIONS: Array<{
  id: GameTiebreakerId;
  label: string;
}> = [
  {
    id: "offensive_special_tds",
    label: "Most total starter offensive + special teams TDs",
  },
  {
    id: "highest_starter",
    label: "Highest individual starter score",
  },
  {
    id: "bench_points",
    label: "Higher bench points total",
  },
];

export const RANK_TIEBREAKER_OPTIONS: Array<{
  id: RankTiebreakerId;
  label: string;
}> = [
  {
    id: "head_to_head",
    label: "Best head-to-head record",
  },
  {
    id: "points_per_game",
    label: "Most average points/game",
  },
  {
    id: "schedule_record",
    label: "Hardest schedule (record)",
  },
  {
    id: "schedule_points",
    label: "Hardest schedule (points)",
  },
];

export const DEFAULT_TIEBREAKER_SETTINGS: TiebreakerSettings = {
  gameTiebreakers: GAME_TIEBREAKER_OPTIONS.map((option) => option.id),
  breakRegularSeasonTies: false,
  rankTiebreakers: RANK_TIEBREAKER_OPTIONS.map((option) => option.id),
  applyOfficialStatChanges: true,
};

const gameIdSchema = z.enum([
  "offensive_special_tds",
  "highest_starter",
  "bench_points",
]);

const rankIdSchema = z.enum([
  "head_to_head",
  "points_per_game",
  "schedule_record",
  "schedule_points",
]);

export const tiebreakerSettingsSchema = z.object({
  gameTiebreakers: z
    .array(gameIdSchema)
    .length(GAME_TIEBREAKER_OPTIONS.length)
    .refine(
      (ids) =>
        GAME_TIEBREAKER_OPTIONS.every((option) => ids.includes(option.id)),
      { message: "Game tiebreakers must include every option once." },
    ),
  breakRegularSeasonTies: z.boolean(),
  rankTiebreakers: z
    .array(rankIdSchema)
    .length(RANK_TIEBREAKER_OPTIONS.length)
    .refine(
      (ids) =>
        RANK_TIEBREAKER_OPTIONS.every((option) => ids.includes(option.id)),
      { message: "Rank tiebreakers must include every option once." },
    ),
  applyOfficialStatChanges: z.boolean(),
});

function normalizeOrderedIds<T extends string>(
  stored: T[] | undefined,
  defaults: T[],
): T[] {
  if (!stored?.length) {
    return [...defaults];
  }

  const seen = new Set<T>();
  const ordered: T[] = [];

  for (const id of stored) {
    if (defaults.includes(id) && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }

  for (const id of defaults) {
    if (!seen.has(id)) {
      ordered.push(id);
    }
  }

  return ordered;
}

export function resolveTiebreakerSettings(
  stored?: TiebreakerSettings | null,
): TiebreakerSettings {
  if (!stored) {
    return { ...DEFAULT_TIEBREAKER_SETTINGS };
  }

  return {
    gameTiebreakers: normalizeOrderedIds(
      stored.gameTiebreakers,
      DEFAULT_TIEBREAKER_SETTINGS.gameTiebreakers,
    ),
    breakRegularSeasonTies:
      stored.breakRegularSeasonTies ??
      DEFAULT_TIEBREAKER_SETTINGS.breakRegularSeasonTies,
    rankTiebreakers: normalizeOrderedIds(
      stored.rankTiebreakers,
      DEFAULT_TIEBREAKER_SETTINGS.rankTiebreakers,
    ),
    applyOfficialStatChanges:
      stored.applyOfficialStatChanges ??
      DEFAULT_TIEBREAKER_SETTINGS.applyOfficialStatChanges,
  };
}

export function labelForGameTiebreaker(id: GameTiebreakerId) {
  return (
    GAME_TIEBREAKER_OPTIONS.find((option) => option.id === id)?.label ?? id
  );
}

export function labelForRankTiebreaker(id: RankTiebreakerId) {
  return (
    RANK_TIEBREAKER_OPTIONS.find((option) => option.id === id)?.label ?? id
  );
}
