export type PlayerWeekSelectItem = {
  label: string;
  value: string;
};

export const REGULAR_SEASON_WEEK_COUNT = 18;

/** Default Players / Rankings week dropdown (NFL regular season). */
export const DEFAULT_PLAYER_WEEK_ITEMS: PlayerWeekSelectItem[] = [
  { label: "Season", value: "season" },
  ...Array.from({ length: REGULAR_SEASON_WEEK_COUNT }, (_, index) => ({
    label: `Week ${index + 1}`,
    value: String(index + 1),
  })),
];
