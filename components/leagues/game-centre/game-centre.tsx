"use client";

import dynamic from "next/dynamic";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AmericanFootballIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { BoxScoreTable } from "@/components/leagues/game-centre/box-score-table";
import { MatchupHeader } from "@/components/leagues/game-centre/matchup-header";
import { MatchupPreviewDashboard } from "@/components/leagues/game-centre/matchup-preview-dashboard";
import { MatchupRosterList } from "@/components/leagues/game-centre/starter-duel-list";
import { WaiverTips } from "@/components/leagues/game-centre/waiver-tips";
import { LIVE_SCORES_GAME_CENTRE_EVENT } from "@/components/scores/live-refresh";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  applyGameCentrePatch,
  type GameCentreLivePatch,
} from "@/lib/leagues/game-centre/game-centre-live-patch";
import { explainPlayerPoints } from "@/lib/leagues/scoring/calculate";
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

function nflGamesHaveStarted(data: GameCentreData) {
  if (data.status !== "scheduled") return true;
  for (const row of [...data.duelRows, ...data.benchRows]) {
    for (const player of [row.away, row.home]) {
      const status = player?.gameStatus ?? player?.opponent?.gameStatus;
      if (status === "in" || status === "post") return true;
    }
  }
  return false;
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

function findPlayerById(
  data: GameCentreData,
  playerId: string,
): GameCentrePlayer | null {
  for (const row of data.duelRows) {
    if (row.away?.id === playerId) return row.away;
    if (row.home?.id === playerId) return row.home;
  }
  for (const row of data.benchRows) {
    if (row.away?.id === playerId) return row.away;
    if (row.home?.id === playerId) return row.home;
  }
  for (const player of data.boxScore.away.starters) {
    if (player.id === playerId) return player;
  }
  for (const player of data.boxScore.home.starters) {
    if (player.id === playerId) return player;
  }
  return null;
}

export function GameCentre({ data }: GameCentreProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [live, setLive] = useState(data);
  const [prevData, setPrevData] = useState(data);

  if (data !== prevData) {
    setPrevData(data);
    setLive(data);
  }

  const scheduled = isScheduled(live.status);
  const tab = parseTab(searchParams.get("tab"), live.status);

  const [optimumOpen, setOptimumOpen] = useState(false);
  const [breakdownPlayerId, setBreakdownPlayerId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const onPatch = (event: Event) => {
      const patch = (event as CustomEvent<GameCentreLivePatch>).detail;
      if (!patch) {
        return;
      }
      if (
        patch.matchupId !== data.matchupId &&
        patch.matchupPublicId !== data.matchupPublicId
      ) {
        return;
      }

      // Preview / optimum / FA tips need a full tree when kickoff starts.
      if (data.status === "scheduled" && patch.status !== "scheduled") {
        router.refresh();
        return;
      }

      setLive((prev) => applyGameCentrePatch(prev, patch));
    };

    window.addEventListener(LIVE_SCORES_GAME_CENTRE_EVENT, onPatch);
    return () => {
      window.removeEventListener(LIVE_SCORES_GAME_CENTRE_EVENT, onPatch);
    };
  }, [data.matchupId, data.matchupPublicId, data.status, router]);

  const breakdownPlayer = breakdownPlayerId
    ? findPlayerById(live, breakdownPlayerId)
    : null;

  const breakdownExplanation = useMemo(() => {
    if (!breakdownPlayer || breakdownPlayer.actualPts == null) return null;
    return explainPlayerPoints(
      breakdownPlayer.stats,
      breakdownPlayer.primaryPositionId,
      live.scoringRules,
    );
  }, [breakdownPlayer, live.scoringRules]);

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
        away={live.away}
        home={live.home}
        status={live.status}
        leagueSlug={live.leagueSlug}
        onProjectedClick={
          live.optimum ? () => setOptimumOpen(true) : undefined
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="max-md:w-full">
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
            {live.preview ? (
              <MatchupPreviewDashboard
                away={live.away}
                home={live.home}
                preview={live.preview}
                leagueSlug={live.leagueSlug}
              />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={AmericanFootballIcon} strokeWidth={2} />
                  </EmptyMedia>
                  <EmptyTitle>Preview unavailable</EmptyTitle>
                  <EmptyDescription>
                    Matchup preview is not available for this pairing yet.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </TabsContent>
        ) : null}

        <TabsContent value="matchup" className="flex flex-col gap-8 pt-4">
          <ScoreLineChart
            data={live.chart}
            awayName={live.away.teamName}
            homeName={live.home.teamName}
            empty={live.chartEmpty}
          />
          <MatchupRosterList
            title="Starters"
            rows={live.duelRows}
            onActualClick={(player) => setBreakdownPlayerId(player.id)}
            emptyMessage="No starters set for this matchup."
            showAdv={!nflGamesHaveStarted(live)}
            leagueSlug={live.leagueSlug}
          />
          <MatchupRosterList
            title="Bench"
            rows={live.benchRows}
            onActualClick={(player) => setBreakdownPlayerId(player.id)}
            emptyMessage="No bench players on either roster."
            showAdv={false}
            leagueSlug={live.leagueSlug}
          />
          <WaiverTips tips={live.waiverTips} leagueSlug={live.leagueSlug} />
        </TabsContent>

        {!scheduled ? (
          <TabsContent value="box" className="flex flex-col gap-8 pt-4">
            <BoxScoreTable
              team={live.boxScore.away}
              onActualClick={(player) => setBreakdownPlayerId(player.id)}
              leagueSlug={live.leagueSlug}
            />
            <BoxScoreTable
              team={live.boxScore.home}
              onActualClick={(player) => setBreakdownPlayerId(player.id)}
              leagueSlug={live.leagueSlug}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      <OptimumLineupDialog
        open={optimumOpen}
        onOpenChange={setOptimumOpen}
        leagueSlug={live.leagueSlug}
        optimum={live.optimum}
      />

      <ScoringBreakdownDialog
        open={breakdownPlayer != null}
        onOpenChange={(open) => {
          if (!open) setBreakdownPlayerId(null);
        }}
        playerName={breakdownPlayer?.fullName ?? ""}
        week={live.week}
        explanation={breakdownExplanation}
      />
    </div>
  );
}
