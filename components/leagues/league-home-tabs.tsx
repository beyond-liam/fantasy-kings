"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const LEAGUE_HOME_TABS = [
  { value: "overview", label: "Overview" },
  { value: "standings", label: "Standings" },
  { value: "stats", label: "Stats" },
  { value: "playoffs", label: "Playoffs" },
  { value: "hall-of-fame", label: "Hall of Fame" },
  { value: "rules", label: "Rules" },
  { value: "scoring", label: "Scoring" },
] as const;

export type LeagueHomeTabValue = (typeof LEAGUE_HOME_TABS)[number]["value"];

const TAB_VALUES = new Set<string>(LEAGUE_HOME_TABS.map((tab) => tab.value));

type LeagueHomeTabsProps = {
  overview: ReactNode;
  standings: ReactNode;
  stats?: ReactNode;
  playoffs?: ReactNode;
  hallOfFame?: ReactNode;
  rules?: ReactNode;
  scoring?: ReactNode;
  defaultTab?: LeagueHomeTabValue;
};

function ComingSoon({ description }: { description: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function resolveTab(raw: string | null, fallback: LeagueHomeTabValue) {
  if (raw && TAB_VALUES.has(raw)) {
    return raw as LeagueHomeTabValue;
  }
  return fallback;
}

export function LeagueHomeTabs({
  overview,
  standings,
  stats,
  playoffs,
  hallOfFame,
  rules,
  scoring,
  defaultTab = "overview",
}: LeagueHomeTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = resolveTab(searchParams.get("tab"), defaultTab);

  const content: Record<LeagueHomeTabValue, ReactNode> = {
    overview,
    standings,
    stats: stats ?? (
      <ComingSoon description="League-wide team stats will show up here." />
    ),
    playoffs: playoffs ?? (
      <ComingSoon description="Playoff bracket and seeding will show up here." />
    ),
    "hall-of-fame": hallOfFame ?? (
      <ComingSoon description="Hall of Fame plaques and awards will show up here." />
    ),
    rules: rules ?? (
      <ComingSoon description="League rules summary will show up here." />
    ),
    scoring: scoring ?? (
      <ComingSoon description="Scoring settings summary will show up here." />
    ),
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "overview") {
          params.delete("tab");
        } else {
          params.set("tab", String(value));
        }
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      }}
      className="gap-6"
    >
      <TabsList>
        {LEAGUE_HOME_TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {LEAGUE_HOME_TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="outline-none">
          {content[tab.value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
