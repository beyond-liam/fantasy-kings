"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRankingsParams } from "@/components/rankings/use-rankings-params";
import type { PositionFilter } from "@/lib/rankings/column-config";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";

export type RankingsViewState = {
  season: string;
  week: string;
  kind: "projection" | "stats";
  position: PositionFilter;
  team: string;
  rookiesOnly: boolean;
  freeAgentsOnly: boolean;
  scoring: ScoringPreset;
  sort: string;
  sortDesc: boolean;
};

type RankingsToolbarProps = {
  currentSeason: string;
  previousSeason: string;
  view: RankingsViewState;
};

export function RankingsToolbar({ view }: RankingsToolbarProps) {
  const updateParams = useRankingsParams();

  const handleKindChange = (value: string) => {
    if (value !== "projection" && value !== "stats") {
      return;
    }

    updateParams({
      kind: value === "projection" ? null : value,
      // Always reset to the current NFL year when switching modes.
      season: null,
    });
  };

  return (
    <Tabs value={view.kind} onValueChange={handleKindChange}>
      <TabsList className="max-md:w-full">
        <TabsTrigger value="projection">Projection</TabsTrigger>
        <TabsTrigger value="stats">Stats</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
