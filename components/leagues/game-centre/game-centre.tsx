"use client";

import dynamic from "next/dynamic";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { BoxScoreTable } from "@/components/leagues/game-centre/box-score-table";
import { MatchupHeader } from "@/components/leagues/game-centre/matchup-header";
import { MatchupPreviewDashboard } from "@/components/leagues/game-centre/matchup-preview-dashboard";
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

const OptimumLineupDialog = dynamic(
  () =>
    import("@/components/leagues/game-centre/optimum-lineup-dialog").then(
      (m) => m.OptimumLineupDialog,
    ),
  { ssr: false },
);

const ScoringBreakdownDialog = dynamic(
  () =>
    import("@/components/leagues/game-centre/scoring-breakdown-dialog").then(
      (m) => m.ScoringBreakdownDialog,
    ),
  { ssr: false },
);

type GameCentreProps = {
  data: GameCentreData;
};

type GameCentreTab = "preview" | "matchup" | "box";

function isScheduled(status: GameCentreData["status"]) {
  return status === "scheduled";
}

function parseTab(
  raw: string | null,
  status: GameCentreData["status"],
): GameCentreTab {
  const scheduled = isScheduled(status);
  if (scheduled) {
    if (raw === "matchup") return "matchup";
    return "preview";
  }
  if (raw === "box") return "box";
  return "matchup";
}

export function GameCentre({ data }: GameCentreProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scheduled = isScheduled(data.status);
  const tab = parseTab(searchParams.get("tab"), data.status);

  const [optimumOpen, setOptimumOpen] = useState(false);
  const [breakdownPlayer, setBreakdownPlayer] =
    useState<GameCentrePlayer | null>(null);

  const setTab = (next: string | number | null) => {
    const value = String(next ?? (scheduled ? "preview" : "matchup"));
    const params = new URLSearchParams(searchParams.toString());
    const defaultTab = scheduled ? "preview" : "matchup";
    if (value === defaultTab) {
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
        status={data.status}
        onProjectedClick={
          data.optimum ? () => setOptimumOpen(true) : undefined
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {scheduled ? (
            <>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="matchup">Matchup</TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="matchup">Matchup</TabsTrigger>
              <TabsTrigger value="box">Box Score</TabsTrigger>
            </>
          )}
        </TabsList>

        {scheduled ? (
          <TabsContent value="preview" className="pt-4">
            {data.preview ? (
              <MatchupPreviewDashboard
                away={data.away}
                home={data.home}
                preview={data.preview}
                leagueSlug={data.leagueSlug}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Preview is unavailable for this matchup.
              </p>
            )}
          </TabsContent>
        ) : null}

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

        {!scheduled ? (
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
        ) : null}
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
