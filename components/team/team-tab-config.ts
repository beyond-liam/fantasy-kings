import {
  Analytics02Icon,
  ArrowLeftRightIcon,
  Bookmark02Icon,
  Calendar03Icon,
  ListViewIcon as ListIcon,
  MoneyExchange03Icon,
  Settings01Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";

export const MY_TEAM_TABS = [
  { value: "roster", label: "Roster", icon: ListIcon },
  { value: "stats", label: "Stats", icon: Analytics02Icon },
  { value: "watchlist", label: "Watchlist", icon: Bookmark02Icon },
  { value: "schedule", label: "Schedule", icon: Calendar03Icon },
  { value: "transactions", label: "Transactions", icon: MoneyExchange03Icon },
  { value: "draft-picks", label: "Draft Picks", icon: UserAdd01Icon },
  { value: "settings", label: "Settings", icon: Settings01Icon },
] as const;

export const OTHER_TEAM_TABS = [
  { value: "roster", label: "Roster", icon: ListIcon },
  { value: "stats", label: "Stats", icon: Analytics02Icon },
  { value: "schedule", label: "Schedule", icon: Calendar03Icon },
  { value: "head-to-head", label: "Head to Head", icon: ArrowLeftRightIcon },
  { value: "draft-picks", label: "Draft Picks", icon: UserAdd01Icon },
] as const;

export type MyTeamTabValue = (typeof MY_TEAM_TABS)[number]["value"];
export type OtherTeamTabValue = (typeof OTHER_TEAM_TABS)[number]["value"];
