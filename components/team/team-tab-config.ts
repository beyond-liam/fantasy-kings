export const MY_TEAM_TABS = [
  { value: "roster", label: "Roster" },
  { value: "stats", label: "Stats" },
  { value: "watchlist", label: "Watchlist" },
  { value: "schedule", label: "Schedule" },
  { value: "transactions", label: "Transactions" },
  { value: "draft-picks", label: "Draft Picks" },
  { value: "settings", label: "Settings" },
] as const;

export const OTHER_TEAM_TABS = [
  { value: "roster", label: "Roster" },
  { value: "stats", label: "Stats" },
  { value: "schedule", label: "Schedule" },
  { value: "draft-picks", label: "Draft Picks" },
] as const;

export type MyTeamTabValue = (typeof MY_TEAM_TABS)[number]["value"];
export type OtherTeamTabValue = (typeof OTHER_TEAM_TABS)[number]["value"];
