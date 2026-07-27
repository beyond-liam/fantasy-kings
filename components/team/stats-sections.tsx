"use client";

import { TeamStatsTable } from "@/components/team/stats-table";
import { TeamStatsDashboard } from "@/components/team/team-stats-dashboard";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { groupRosterPlayersForStats } from "@/lib/leagues/team-stats";
import type { RankedPlayerRow } from "@/lib/queries/players";
import type { TeamStatsChartsData } from "@/lib/queries/team-stats-charts";

type TeamStatsSectionsProps = {
  players: RankedPlayerRow[];
  leagueSlug?: string | null;
  charts?: TeamStatsChartsData | null;
};

export function TeamStatsSections({
  players,
  leagueSlug,
  charts,
}: TeamStatsSectionsProps) {
  const sections = groupRosterPlayersForStats(players);

  return (
    <Tabs defaultValue="player-stats" className="gap-6">
      <TabsList variant="line">
        <TabsTrigger value="player-stats">Player Stats</TabsTrigger>
        <TabsTrigger value="team-stats">Team Stats</TabsTrigger>
      </TabsList>

      <TabsContent value="player-stats">
        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <TeamStatsTable
              key={section.id}
              section={section}
              leagueSlug={leagueSlug}
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="team-stats">
        <TeamStatsDashboard
          charts={
            charts ?? {
              weeklyPoints: [],
              positionMix: [],
              weeklyLuck: [],
              benchWaste: [],
              gamesFlippedByBench: 0,
              kpis: {
                avgWinMargin: { average: null, sampleSize: 0 },
                avgLossMargin: { average: null, sampleSize: 0 },
                avgWeeklyScore: {
                  average: null,
                  sampleSize: 0,
                  consistencyPlusMinus: null,
                  consistency: null,
                },
              },
            }
          }
        />
      </TabsContent>
    </Tabs>
  );
}
