"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NflStandingsTable } from "@/components/scores/nfl-standings-table";
import type {
  NflStandingGroup,
  NflStandings,
} from "@/lib/espn/standings";
import { cn } from "@/lib/utils";

type NflStandingsPanelProps = {
  standings: NflStandings;
  className?: string;
};

function StandingsGroupList({ groups }: { groups: NflStandingGroup[] }) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <NflStandingsTable key={group.id} group={group} />
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
      <Tabs defaultValue="div" className="gap-3">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1 px-1.5 text-xs">
            All
          </TabsTrigger>
          <TabsTrigger value="conf" className="flex-1 px-1.5 text-xs">
            Conference
          </TabsTrigger>
          <TabsTrigger value="div" className="flex-1 px-1.5 text-xs">
            Division
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-0">
          <NflStandingsTable group={standings.all} />
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
