"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";

import { PowerRankingRow } from "@/components/leagues/power-rankings/power-ranking-row";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { PowerRankingTeamRow } from "@/lib/leagues/power-rankings/types";

type PowerRankingsListProps = {
  rows: PowerRankingTeamRow[];
  leagueSlug: string;
};

const LAYOUT_TRANSITION = {
  type: "spring" as const,
  duration: 0.3,
  bounce: 0,
};

export function PowerRankingsList({
  rows,
  leagueSlug,
}: PowerRankingsListProps) {
  const reduceMotion = useReducedMotion();

  if (rows.length === 0) {
    return (
      <Empty size="sm">
        <EmptyHeader>
          <EmptyTitle>No teams yet</EmptyTitle>
          <EmptyDescription>
            Power rankings will appear once teams are in this league.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <LayoutGroup id="power-rankings">
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <motion.li
            key={row.teamId}
            layout={reduceMotion ? false : "position"}
            transition={LAYOUT_TRANSITION}
            className="relative"
          >
            <PowerRankingRow row={row} leagueSlug={leagueSlug} />
          </motion.li>
        ))}
      </ul>
    </LayoutGroup>
  );
}
