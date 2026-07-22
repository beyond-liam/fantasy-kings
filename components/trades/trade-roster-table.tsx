"use client";

import { PlayerIdentity } from "@/components/rankings/player-identity";
import { TeamTableColumnHeader } from "@/components/team/team-table-column-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
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
import { teamInitials } from "@/lib/leagues/standings";
import { PLAYER_STAT_COLUMNS } from "@/lib/rankings/player-stat-columns";
import type { TradePlayerRow } from "@/lib/queries/trades";
import {
  formatPositionRank,
  getPositionRankColorClass,
} from "@/lib/rankings/stat-helpers";
import { cn } from "@/lib/utils";

type TradeRosterTableProps = {
  teamName: string | null;
  players: TradePlayerRow[];
  selectedIds: Set<string>;
  onToggle: (playerId: string) => void;
  dropMode?: boolean;
  disabled?: boolean;
};

const PLACEHOLDER = "—";

export function TradeRosterTable({
  teamName,
  players,
  selectedIds,
  onToggle,
  dropMode = false,
  disabled = false,
}: TradeRosterTableProps) {
  const table = (
    <TooltipProvider>
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Player</TableHead>
              <TableHead className="w-16">
                <TeamTableColumnHeader
                  title={PLAYER_STAT_COLUMNS.pick.header}
                  tooltip={PLAYER_STAT_COLUMNS.pick.tooltip}
                />
              </TableHead>
              <TableHead className="w-14">
                <TeamTableColumnHeader
                  title={PLAYER_STAT_COLUMNS.rank.header}
                  tooltip={PLAYER_STAT_COLUMNS.rank.tooltip}
                />
              </TableHead>
              <TableHead className="w-16">
                <TeamTableColumnHeader
                  title={PLAYER_STAT_COLUMNS.fpts.header}
                  tooltip={PLAYER_STAT_COLUMNS.fpts.tooltip}
                />
              </TableHead>
              <TableHead className="w-16">
                <TeamTableColumnHeader
                  title={PLAYER_STAT_COLUMNS.avg.header}
                  tooltip={PLAYER_STAT_COLUMNS.avg.tooltip}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player) => {
              const checked = selectedIds.has(player.id);
              const rowDisabled =
                disabled || player.locked || (!dropMode && player.locked);

              return (
                <TableRow
                  key={player.id}
                  data-state={checked ? "selected" : undefined}
                  className={cn(checked && "bg-muted/50")}
                >
                  <TableCell>
                    <Checkbox
                      checked={checked}
                      disabled={rowDisabled}
                      onCheckedChange={() => {
                        if (!rowDisabled) {
                          onToggle(player.id);
                        }
                      }}
                      aria-label={`Select ${player.fullName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <PlayerIdentity
                      fullName={player.fullName}
                      sleeperId={player.sleeperId}
                      primaryPositionId={player.primaryPositionId}
                      nflTeam={player.nflTeam}
                      size="sm"
                      playerId={player.id}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {player.acquisitionLabel}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "tabular-nums",
                      getPositionRankColorClass(player.positionRank),
                    )}
                  >
                    {formatPositionRank(
                      player.primaryPositionId,
                      player.positionRank,
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {PLACEHOLDER}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {PLACEHOLDER}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableShell>
    </TooltipProvider>
  );

  if (!teamName) {
    return table;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar size="sm" className="shrink-0">
          <AvatarFallback>{teamInitials(teamName)}</AvatarFallback>
        </Avatar>
        <h2 className="truncate text-lg font-semibold tracking-tight">
          {teamName}
        </h2>
      </div>
      {table}
    </section>
  );
}
