export type PositionRankSource = {
  kind: "projection" | "stats";
  week: number;
  seasonType?: string;
};

type RankWeekPoint = {
  week: number;
  seasonType?: string;
};

const SEASON_TYPE_ORDER: Record<string, number> = {
  pre: 0,
  regular: 1,
  post: 2,
};

/** Counting NFL week loaded for stats — week 0 means no games yet. */
export function countingGamesHaveStarted(statsPoint: {
  week: number;
}): boolean {
  return statsPoint.week >= 1;
}

/** True when `selected` is on or before the latest counting NFL week. */
export function statsWeekHasOccurred(
  selected: RankWeekPoint,
  current: RankWeekPoint,
): boolean {
  const selectedType = SEASON_TYPE_ORDER[selected.seasonType ?? "regular"] ?? 1;
  const currentType = SEASON_TYPE_ORDER[current.seasonType ?? "regular"] ?? 1;
  if (selectedType !== currentType) {
    return selectedType < currentType;
  }
  return selected.week <= current.week;
}

/**
 * RANK follows the table tab.
 *
 * Projection: always projected rank for the week on screen (season = week 0).
 * Stats: once counting games have started, positive actuals take 1..N,
 * then zeros (played 0s, then unplayed in projection order), then negatives.
 * Weeks that have not been played yet use the latest counting week's hybrid
 * ranks. Before counting games start, Stats still uses season-long projected rank.
 *
 * Player identity card uses this Stats source for the current NFL season.
 */
export function resolveTablePositionRanks(input: {
  kind: "projection" | "stats";
  scorePoint: RankWeekPoint;
  statsPoint: RankWeekPoint;
  isCurrentSeason?: boolean;
}): PositionRankSource {
  if (input.kind === "projection") {
    return {
      kind: "projection",
      week: input.scorePoint.week,
      seasonType: input.scorePoint.seasonType,
    };
  }

  const isCurrentSeason = input.isCurrentSeason !== false;
  if (isCurrentSeason && !countingGamesHaveStarted(input.statsPoint)) {
    return { kind: "projection", week: 0, seasonType: "regular" };
  }

  if (
    isCurrentSeason &&
    !statsWeekHasOccurred(input.scorePoint, input.statsPoint)
  ) {
    return {
      kind: "stats",
      week: input.statsPoint.week,
      seasonType: input.statsPoint.seasonType,
    };
  }

  return {
    kind: "stats",
    week: input.scorePoint.week,
    seasonType: input.scorePoint.seasonType,
  };
}
