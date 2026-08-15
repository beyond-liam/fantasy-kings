"use client";

import { ScheduleTeamLogo } from "@/components/scores/schedule-team-logo";
import type { NflStandingGroup } from "@/lib/espn/standings";
import { cn } from "@/lib/utils";

type NflStandingsTableProps = {
  group: NflStandingGroup;
  highlightedAbbrevs?: ReadonlySet<string>;
};

const COLUMNS =
  "1.5rem minmax(0,1fr) 1.5rem 1.5rem 1.5rem 2.5rem";

export function NflStandingsTable({
  group,
  highlightedAbbrevs,
}: NflStandingsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div
        className="grid items-center gap-2 border-b border-border/60 px-3 py-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
        style={{ gridTemplateColumns: COLUMNS }}
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
            className={cn(
              "grid items-center gap-2 px-3 py-2.5",
              highlightedAbbrevs?.has(row.abbreviation) && "bg-muted/50",
            )}
            style={{ gridTemplateColumns: COLUMNS }}
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
