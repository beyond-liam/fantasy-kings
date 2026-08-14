/** Shared short headers + tooltips for season player columns. */
export const PLAYER_STAT_COLUMNS = {
  pick: {
    header: "PICK",
    tooltip:
      "Round picked when drafted, or Claimed off waivers if claimed or a FA",
  },
  rank: {
    header: "RANK",
    tooltip:
      "Position rank. Stats: positive actuals, then zeros, then negatives. Unplayed zeros follow projection order.",
  },
  fpts: {
    header: "FPTS",
    tooltip: "Fantasy points scored",
  },
  avg: {
    header: "AVG",
    tooltip: "Average weekly points scored",
  },
} as const;
