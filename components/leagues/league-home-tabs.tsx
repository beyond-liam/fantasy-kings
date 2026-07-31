"use client";

import { type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Analytics02Icon,
  DashboardSquare02Icon,
  HierarchySquare05Icon,
  Calculator01Icon,
  Legal01Icon,
  LeftToRightListNumberIcon,
  ListOrdered as ListOrderedIcon,
  StarAward01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { MobileTabDrawer } from "@/components/layout/mobile-tab-drawer";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const LEAGUE_HOME_TABS = [
  { value: "overview", label: "Overview", icon: DashboardSquare02Icon },
  { value: "standings", label: "Standings", icon: ListOrderedIcon },
  { value: "stats", label: "Stats", icon: Analytics02Icon },
  { value: "playoffs", label: "Playoffs", icon: HierarchySquare05Icon },
  { value: "hall-of-fame", label: "Hall of Fame", icon: StarAward01Icon },
  { value: "rules", label: "Rules", icon: Legal01Icon },
  { value: "scoring", label: "Scoring", icon: Calculator01Icon },
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
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={LeftToRightListNumberIcon} strokeWidth={2} />
        </EmptyMedia>
        <EmptyTitle>Coming soon</EmptyTitle>
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

  function setTab(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={setTab}
      className="gap-6"
    >
      <TabsList className="hidden md:inline-flex">
        {LEAGUE_HOME_TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <MobileTabDrawer
        items={LEAGUE_HOME_TABS}
        value={activeTab}
        onSelect={setTab}
        title="League sections"
        description="Choose which league home section to view"
      />

      {LEAGUE_HOME_TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="outline-none">
          {content[tab.value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
