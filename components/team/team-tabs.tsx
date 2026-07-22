"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
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

const MY_TEAM_TABS = [
  { value: "roster", label: "Roster" },
  { value: "stats", label: "Stats" },
  { value: "watchlist", label: "Watchlist" },
  { value: "schedule", label: "Schedule" },
  { value: "transactions", label: "Transactions" },
  { value: "draft-picks", label: "Draft Picks" },
  { value: "settings", label: "Settings" },
] as const;

const OTHER_TEAM_TABS = [
  { value: "roster", label: "Roster" },
  { value: "stats", label: "Stats" },
  { value: "schedule", label: "Schedule" },
  { value: "draft-picks", label: "Draft Picks" },
] as const;

type MyTeamTabValue = (typeof MY_TEAM_TABS)[number]["value"];
type OtherTeamTabValue = (typeof OTHER_TEAM_TABS)[number]["value"];

type BaseTeamTabsProps = {
  roster: ReactNode;
  stats: ReactNode;
  schedule?: ReactNode;
  "draft-picks"?: ReactNode;
  defaultTab?: string;
};

type MyTeamTabsProps = BaseTeamTabsProps & {
  variant?: "mine";
  watchlist: ReactNode;
  transactions?: ReactNode;
  transactionsBadge?: number;
  settings?: ReactNode;
};

type OtherTeamTabsProps = BaseTeamTabsProps & {
  variant: "other";
  watchlist?: never;
  transactions?: never;
  transactionsBadge?: never;
  settings?: never;
};

type TeamTabsProps = MyTeamTabsProps | OtherTeamTabsProps;

function ComingSoon({ description }: { description: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function TeamTabs(props: TeamTabsProps) {
  const isOther = props.variant === "other";
  const tabs = isOther ? OTHER_TEAM_TABS : MY_TEAM_TABS;
  const defaultTab =
    props.defaultTab &&
    tabs.some((tab) => tab.value === props.defaultTab)
      ? props.defaultTab
      : "roster";

  const content: Record<string, ReactNode> = {
    roster: props.roster,
    stats: props.stats,
    schedule: props.schedule ?? (
      <ComingSoon description="Team schedule will show matchups week by week." />
    ),
    "draft-picks": props["draft-picks"] ?? (
      <ComingSoon description="Draft pick inventory and trades will show up here." />
    ),
  };

  if (!isOther) {
    content.watchlist = props.watchlist;
    content.transactions = props.transactions ?? (
      <ComingSoon description="Waiver claims and trades will show up here." />
    );
    content.settings = props.settings ?? (
      <ComingSoon description="Team name, logo, and manager settings will show up here." />
    );
  }

  return (
    <Tabs defaultValue={defaultTab} className="gap-6">
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
            {tab.label}
            {!isOther &&
            tab.value === "transactions" &&
            props.transactionsBadge != null &&
            props.transactionsBadge > 0 ? (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5">
                {props.transactionsBadge}
              </Badge>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="outline-none">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold tracking-tight">
              {tab.label}
            </h2>
            {content[tab.value]}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}

export type { MyTeamTabValue, OtherTeamTabValue };
