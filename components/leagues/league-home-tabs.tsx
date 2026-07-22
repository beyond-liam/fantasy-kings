"use client";

import type { ReactNode } from "react";

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
  { value: "standings", label: "Standings" },
  { value: "stats", label: "Stats" },
  { value: "playoffs", label: "Playoffs" },
  { value: "rules", label: "Rules" },
  { value: "scoring", label: "Scoring" },
] as const;

export type LeagueHomeTabValue = (typeof LEAGUE_HOME_TABS)[number]["value"];

type LeagueHomeTabsProps = {
  standings: ReactNode;
  stats?: ReactNode;
  playoffs?: ReactNode;
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

export function LeagueHomeTabs({
  standings,
  stats,
  playoffs,
  rules,
  scoring,
  defaultTab = "standings",
}: LeagueHomeTabsProps) {
  const content: Record<LeagueHomeTabValue, ReactNode> = {
    standings,
    stats: stats ?? (
      <ComingSoon description="League-wide team stats will show up here." />
    ),
    playoffs: playoffs ?? (
      <ComingSoon description="Playoff bracket and seeding will show up here." />
    ),
    rules: rules ?? (
      <ComingSoon description="League rules summary will show up here." />
    ),
    scoring: scoring ?? (
      <ComingSoon description="Scoring settings summary will show up here." />
    ),
  };

  return (
    <Tabs defaultValue={defaultTab} className="gap-6">
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
