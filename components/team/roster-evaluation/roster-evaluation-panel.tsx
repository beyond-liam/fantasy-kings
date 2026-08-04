"use client";

import { useMemo, useState } from "react";

import { EvaluationRankingsTable } from "@/components/team/roster-evaluation/evaluation-rankings-table";
import { PositionStrengthRadar } from "@/components/team/roster-evaluation/position-strength-radar";
import { StartingLineupChart } from "@/components/team/roster-evaluation/starting-lineup-chart";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildScaffoldRosterEvaluation } from "@/lib/leagues/roster-evaluation/scaffold";
import type {
  RosterEvaluationData,
  RosterEvaluationMode,
} from "@/lib/leagues/roster-evaluation/types";

type RosterEvaluationPanelProps = {
  upcomingWeek: number;
  evaluationByMode?: Record<RosterEvaluationMode, RosterEvaluationData> | null;
};

export function RosterEvaluationPanel({
  upcomingWeek,
  evaluationByMode,
}: RosterEvaluationPanelProps) {
  const [mode, setMode] = useState<RosterEvaluationMode>("draft");

  const modeItems = useMemo(
    () => [
      { value: "draft" as const, label: "Draft Rankings" },
      { value: "week" as const, label: `Week ${upcomingWeek}` },
      { value: "rest-of-season" as const, label: "Rest of Season" },
    ],
    [upcomingWeek],
  );

  const data =
    evaluationByMode?.[mode] ?? buildScaffoldRosterEvaluation(mode);

  return (
    <div className="flex flex-col gap-4">
      <Select
        items={modeItems}
        value={mode}
        onValueChange={(value) => {
          if (
            value === "draft" ||
            value === "week" ||
            value === "rest-of-season"
          ) {
            setMode(value);
          }
        }}
      >
        <SelectTrigger
          size="sm"
          className="w-[10.5rem]"
          aria-label="Roster evaluation mode"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectGroup>
            {modeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <div className="grid gap-6 md:grid-cols-2">
        <PositionStrengthRadar data={data.positionStrength} />
        <StartingLineupChart
          slots={data.startingLineup}
          teamCount={data.teamCount}
        />
        <EvaluationRankingsTable
          title="Positional Rankings"
          rows={data.positionalRankings}
        />
        <EvaluationRankingsTable
          title="Starter Rankings"
          rows={data.starterRankings}
        />
      </div>
    </div>
  );
}
