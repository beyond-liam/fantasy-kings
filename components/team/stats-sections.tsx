"use client";

import { TeamStatsTable } from "@/components/team/stats-table";
import { TeamStatsDashboard } from "@/components/team/team-stats-dashboard";
import { RosterEvaluationPanel } from "@/components/team/roster-evaluation/roster-evaluation-panel";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { groupRosterPlayersForStats } from "@/lib/leagues/team-stats";
import type {
  RosterEvaluationData,
  RosterEvaluationMode,
} from "@/lib/leagues/roster-evaluation/types";
import type { RankedPlayerRow } from "@/lib/queries/players";
import type { TeamStatsChartsData } from "@/lib/queries/team-stats-charts";

type TeamStatsSectionsProps = {
  players: RankedPlayerRow[];
  leagueSlug?: string | null;
  charts?: TeamStatsChartsData | null;
  upcomingWeek?: number;
  rosterEvaluationByMode?: Record<
    RosterEvaluationMode,
    RosterEvaluationData
  > | null;
};

export function TeamStatsSections({
  players,
  leagueSlug,
  charts,
  upcomingWeek = 1,
  rosterEvaluationByMode = null,
}: TeamStatsSectionsProps) {
  const sections = groupRosterPlayersForStats(players);

  return (
    <Tabs defaultValue="player-stats" className="gap-6">
      <TabsList variant="line">
        <TabsTrigger value="player-stats">Player Stats</TabsTrigger>
        <TabsTrigger value="team-stats">Team Stats</TabsTrigger>
        <TabsTrigger value="roster-evaluation">Roster Evaluation</TabsTrigger>
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
              scoringConcentration: {
                slices: [],
                topShare: null,
                topN: 3,
                totalPoints: 0,
              },
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

      <TabsContent value="roster-evaluation">
        <RosterEvaluationPanel
          upcomingWeek={upcomingWeek}
          evaluationByMode={rosterEvaluationByMode}
        />
      </TabsContent>
    </Tabs>
  );
}
