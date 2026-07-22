import type { IconSvgElement } from "@hugeicons/react";
import {
  Activity01Icon,
  AddTeamIcon,
  AmericanFootballIcon,
  ChartIcon,
  Home09Icon,
  LeftToRightListDashIcon,
  LeftToRightListNumberIcon,
  NoteEditIcon,
  RankingIcon,
  Settings01Icon,
  SplitIcon,
  UserGroupIcon,
  UserSwitchIcon,
} from "@hugeicons/core-free-icons";

import { isLeagueTeamPathname } from "@/lib/leagues/utils";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: IconSvgElement;
  isActive: (pathname: string) => boolean;
  commissionerOnly?: boolean;
};

export const appNavItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    icon: Home09Icon,
    isActive: (pathname) => pathname === "/dashboard",
  },
  {
    href: "/leagues",
    label: "Leagues",
    shortLabel: "Leagues",
    icon: LeftToRightListDashIcon,
    isActive: (pathname) =>
      pathname.startsWith("/leagues") || pathname.startsWith("/league/"),
  },
  {
    href: "/draft-room",
    label: "Mock Draft",
    shortLabel: "Mock Draft",
    icon: NoteEditIcon,
    isActive: (pathname) => pathname.startsWith("/draft-room"),
  },
  {
    href: "/trade-analyzer",
    label: "Trade Analyzer",
    shortLabel: "Trade Analyzer",
    icon: SplitIcon,
    isActive: (pathname) => pathname.startsWith("/trade-analyzer"),
  },
  {
    href: "/rankings",
    label: "Rankings",
    shortLabel: "Rankings",
    icon: RankingIcon,
    isActive: (pathname) => pathname.startsWith("/rankings"),
  },
  {
    href: "/scores",
    label: "NFL Scores",
    shortLabel: "NFL",
    icon: AmericanFootballIcon,
    isActive: (pathname) => pathname.startsWith("/scores"),
  },
];

export function getLeagueNavItems(leagueId: string): NavItem[] {
  const base = `/league/${leagueId}`;

  return [
    {
      href: base,
      label: "League",
      shortLabel: "League",
      icon: LeftToRightListNumberIcon,
      isActive: (pathname) =>
        pathname === base || isLeagueTeamPathname(pathname, base),
    },
    {
      href: `${base}/team`,
      label: "My Team",
      shortLabel: "Team",
      icon: UserGroupIcon,
      isActive: (pathname) => pathname === `${base}/team`,
    },
    {
      href: `${base}/players`,
      label: "Players",
      shortLabel: "Players",
      icon: AddTeamIcon,
      isActive: (pathname) => pathname.startsWith(`${base}/players`),
    },
    {
      href: `${base}/scores`,
      label: "Matchups",
      shortLabel: "Matchups",
      icon: ChartIcon,
      isActive: (pathname) => pathname.startsWith(`${base}/scores`),
    },
    {
      href: `${base}/trades`,
      label: "Trades",
      shortLabel: "Trades",
      icon: UserSwitchIcon,
      isActive: (pathname) => pathname.startsWith(`${base}/trades`),
    },
    {
      href: `${base}/activity`,
      label: "Activity",
      shortLabel: "Activity",
      icon: Activity01Icon,
      isActive: (pathname) => pathname.startsWith(`${base}/activity`),
    },
    {
      href: `${base}/draft`,
      label: "League Draft",
      shortLabel: "Draft",
      icon: NoteEditIcon,
      isActive: (pathname) => pathname.startsWith(`${base}/draft`),
    },
    {
      href: `${base}/settings`,
      label: "Settings",
      shortLabel: "Settings",
      icon: Settings01Icon,
      isActive: (pathname) => pathname.startsWith(`${base}/settings`),
      commissionerOnly: true,
    },
  ];
}

export function formatLeagueSlug(slug: string) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
