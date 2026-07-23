"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

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
import {
  MY_TEAM_TABS,
  OTHER_TEAM_TABS,
} from "@/components/team/team-tab-config";

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

function TabLoading() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyDescription>Loading…</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function resolvePanel(node: ReactNode | undefined, fallback: ReactNode) {
  if (node === undefined) {
    return fallback;
  }
  if (node == null) {
    return <TabLoading />;
  }
  return node;
}

export function TeamTabs(props: TeamTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isOther = props.variant === "other";
  const tabs = isOther ? OTHER_TEAM_TABS : MY_TEAM_TABS;
  const activeTab =
    props.defaultTab &&
    tabs.some((tab) => tab.value === props.defaultTab)
      ? props.defaultTab
      : "roster";

  const content: Record<string, ReactNode> = {
    roster: resolvePanel(props.roster, <TabLoading />),
    stats: resolvePanel(props.stats, <TabLoading />),
    schedule: resolvePanel(
      props.schedule,
      <ComingSoon description="Team schedule will show matchups week by week." />,
    ),
    "draft-picks": resolvePanel(
      props["draft-picks"],
      <ComingSoon description="Draft pick inventory and trades will show up here." />,
    ),
  };

  if (!isOther) {
    content.watchlist = resolvePanel(props.watchlist, <TabLoading />);
    content.transactions = resolvePanel(
      props.transactions,
      <ComingSoon description="Waiver claims and trades will show up here." />,
    );
    content.settings = resolvePanel(
      props.settings,
      <ComingSoon description="Team name, logo, and manager settings will show up here." />,
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        const params = new URLSearchParams();
        if (value !== "roster") {
          params.set("tab", value);
        }
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
      className="gap-6"
    >
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
            <div className="contents">{content[tab.value]}</div>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}

export type { MyTeamTabValue, OtherTeamTabValue } from "@/components/team/team-tab-config";
