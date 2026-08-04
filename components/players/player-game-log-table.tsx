"use client";

import { TeamTableColumnHeader } from "@/components/team/team-table-column-header";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PlayerProfile } from "@/lib/queries/player-profile";

function formatPts(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

function formatStat(value: number | null | undefined, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Number.isInteger(value) && decimals <= 1) return String(value);
  return value.toFixed(decimals);
}

type PlayerGameLogTableProps = {
  profile: PlayerProfile;
  /** Sticky cells use dialog bg in modal; page content uses background. */
  stickyBgClassName?: string;
};

export function PlayerGameLogTable({
  profile,
  stickyBgClassName = "bg-dialog",
}: PlayerGameLogTableProps) {
  if (profile.gameLog.length === 0) {
    return (
      <Empty className="border-none" size="sm">
        <EmptyHeader>
          <EmptyTitle>No schedule yet</EmptyTitle>
          <EmptyDescription>
            Game log for {profile.season} appears once the schedule is set.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const columns = profile.gameLogColumns.slice(0, 8);

  return (
    <TableShell className="relative z-0 isolate min-w-0">
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-[1] w-12 min-w-12">
                <TeamTableColumnHeader title="Wk" tooltip="NFL week" />
              </TableHead>
              <TableHead className="sticky left-12 z-[1] min-w-[4.5rem] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]">
                <TeamTableColumnHeader title="Opp" tooltip="Opponent" />
              </TableHead>
              {columns.map((column) => (
                <TableHead key={column.key} className="tabular-nums">
                  <TeamTableColumnHeader
                    title={column.header}
                    tooltip={column.tooltip}
                  />
                </TableHead>
              ))}
              <TableHead className="tabular-nums">
                <TeamTableColumnHeader
                  title="FPts"
                  tooltip="Fantasy points"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profile.gameLog.map((row) => (
              <TableRow key={row.week}>
                <TableCell
                  className={`sticky left-0 z-[1] w-12 min-w-12 tabular-nums group-hover/tr:bg-muted/50 ${stickyBgClassName}`}
                >
                  {row.week}
                </TableCell>
                <TableCell
                  className={`sticky left-12 z-[1] min-w-[4.5rem] whitespace-nowrap text-muted-foreground shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)] group-hover/tr:bg-muted/50 ${stickyBgClassName}`}
                >
                  {row.opponent ?? "—"}
                </TableCell>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className="tabular-nums text-muted-foreground"
                  >
                    {formatStat(
                      row.stats[column.key] ?? null,
                      column.decimals ?? 1,
                    )}
                  </TableCell>
                ))}
                <TableCell className="tabular-nums font-medium">
                  {formatPts(row.fantasyPts)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TooltipProvider>
    </TableShell>
  );
}
