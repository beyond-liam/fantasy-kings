"use client";

import dynamic from "next/dynamic";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { BoxScoreTable } from "@/components/leagues/game-centre/box-score-table";
import { MatchupHeader } from "@/components/leagues/game-centre/matchup-header";
import { OptimumLineupDialog } from "@/components/leagues/game-centre/optimum-lineup-dialog";
import { ScoringBreakdownDialog } from "@/components/leagues/game-centre/scoring-breakdown-dialog";
import { MatchupRosterList } from "@/components/leagues/game-centre/starter-duel-list";
import { WaiverTips } from "@/components/leagues/game-centre/waiver-tips";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  GameCentreData,
  GameCentrePlayer,
} from "@/lib/queries/game-centre";

const ScoreLineChart = dynamic(
  () =>
    import("@/components/leagues/game-centre/score-line-chart").then(
      (m) => m.ScoreLineChart,
    ),
  { ssr: false },
);

type GameCentreProps = {
  data: GameCentreData;
};

function parseTab(raw: string | null): "matchup" | "box" {
  return raw === "box" ? "box" : "matchup";
}

export function GameCentre({ data }: GameCentreProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const [optimumOpen, setOptimumOpen] = useState(false);
  const [breakdownPlayer, setBreakdownPlayer] =
    useState<GameCentrePlayer | null>(null);

  const setTab = (next: string | number | null) => {
    const value = String(next ?? "matchup");
    const params = new URLSearchParams(searchParams.toString());
    if (value === "matchup") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <MatchupHeader
        away={data.away}
        home={data.home}
        onProjectedClick={
          data.optimum ? () => setOptimumOpen(true) : undefined
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="matchup">Matchup</TabsTrigger>
          <TabsTrigger value="box">Box Score</TabsTrigger>
        </TabsList>

        <TabsContent value="matchup" className="flex flex-col gap-8 pt-4">
          <ScoreLineChart
            data={data.chart}
            awayName={data.away.teamName}
            homeName={data.home.teamName}
            empty={data.chartEmpty}
          />
          <MatchupRosterList
            title="Starters"
            rows={data.duelRows}
            onActualClick={setBreakdownPlayer}
            emptyMessage="No starters set for this matchup."
          />
          <MatchupRosterList
            title="Bench"
            rows={data.benchRows}
            onActualClick={setBreakdownPlayer}
            emptyMessage="No bench players on either roster."
            showAdv={false}
          />
          <WaiverTips tips={data.waiverTips} leagueSlug={data.leagueSlug} />
        </TabsContent>

        <TabsContent value="box" className="flex flex-col gap-8 pt-4">
          <BoxScoreTable
            team={data.boxScore.away}
            onActualClick={setBreakdownPlayer}
            leagueSlug={data.leagueSlug}
          />
          <BoxScoreTable
            team={data.boxScore.home}
            onActualClick={setBreakdownPlayer}
            leagueSlug={data.leagueSlug}
          />
        </TabsContent>
      </Tabs>

      <OptimumLineupDialog
        open={optimumOpen}
        onOpenChange={setOptimumOpen}
        leagueSlug={data.leagueSlug}
        optimum={data.optimum}
      />

      <ScoringBreakdownDialog
        open={breakdownPlayer != null}
        onOpenChange={(open) => {
          if (!open) setBreakdownPlayer(null);
        }}
        playerName={breakdownPlayer?.fullName ?? ""}
        week={data.week}
        explanation={breakdownPlayer?.scoringBreakdown ?? null}
      />
    </div>
  );
}
