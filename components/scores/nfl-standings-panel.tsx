"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScheduleTeamLogo } from "@/components/scores/schedule-team-logo";
import type {
  NflStandingGroup,
  NflStandings,
} from "@/lib/espn/standings";
import { cn } from "@/lib/utils";

type NflStandingsPanelProps = {
  standings: NflStandings;
  className?: string;
};

function StandingsTable({ group }: { group: NflStandingGroup }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div
        className="grid items-center gap-2 border-b border-border/60 px-3 py-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
        style={{
          gridTemplateColumns:
            "1.5rem minmax(0,1fr) 1.5rem 1.5rem 1.5rem 2.5rem",
        }}
      >
        <span>RK</span>
        <span>{group.teamColumnLabel}</span>
        <span className="text-right">W</span>
        <span className="text-right">L</span>
        <span className="text-right">T</span>
        <span className="text-right">%</span>
      </div>
      <ul className="divide-y divide-border/60">
        {group.rows.map((row) => (
          <li
            key={`${group.id}-${row.abbreviation}`}
            className="grid items-center gap-2 px-3 py-2.5"
            style={{
              gridTemplateColumns:
                "1.5rem minmax(0,1fr) 1.5rem 1.5rem 1.5rem 2.5rem",
            }}
          >
            <span className="text-sm tabular-nums text-muted-foreground">
              {row.rank}
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <ScheduleTeamLogo
                src={row.logoUrl}
                size={20}
                className="size-5"
              />
              <span className="truncate text-sm font-semibold">
                {row.abbreviation}
              </span>
            </div>
            <span className="text-right text-sm tabular-nums">{row.wins}</span>
            <span className="text-right text-sm tabular-nums">{row.losses}</span>
            <span className="text-right text-sm tabular-nums">{row.ties}</span>
            <span className="text-right text-sm tabular-nums">{row.winPct}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StandingsGroupList({ groups }: { groups: NflStandingGroup[] }) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <StandingsTable key={group.id} group={group} />
      ))}
    </div>
  );
}

export function NflStandingsPanel({
  standings,
  className,
}: NflStandingsPanelProps) {
  return (
    <aside className={cn("min-w-0", className)}>
      <Tabs defaultValue="all" className="gap-3">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            All
          </TabsTrigger>
          <TabsTrigger value="conf" className="flex-1">
            Conf
          </TabsTrigger>
          <TabsTrigger value="div" className="flex-1">
            Div
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-0">
          <StandingsTable group={standings.all} />
        </TabsContent>
        <TabsContent value="conf" className="mt-0">
          <StandingsGroupList groups={standings.conferences} />
        </TabsContent>
        <TabsContent value="div" className="mt-0">
          <StandingsGroupList groups={standings.divisions} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
