"use client";

import { PlayerIdentity } from "@/components/rankings/player-identity";
import { TeamTableColumnHeader } from "@/components/team/team-table-column-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";
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
import { PLAYER_STAT_COLUMNS } from "@/lib/rankings/player-stat-columns";
import {
  groupRosterPlayersForStats,
  type TeamStatsSection,
} from "@/lib/leagues/team-stats";
import {
  formatStatValue,
  getStatColumns,
  type StatColumn,
} from "@/lib/rankings/column-config";
import {
  formatPositionRank,
  getAdp,
  getFantasyPts,
  getPositionRankColorClass,
} from "@/lib/rankings/stat-helpers";
import type { RankedPlayerRow } from "@/lib/queries/players";
import { cn } from "@/lib/utils";

type DraftRosterTabProps = {
  players: RankedPlayerRow[];
  /** overall pick number keyed by player id */
  pickByPlayerId: Record<string, number>;
  leagueSlug?: string | null;
};

const PLACEHOLDER = "—";
const PLAYER_COLUMN_WIDTH = "14rem";
const PLAYER_COLUMN_CLASS = "w-[14rem]";

function renderStatCell(row: RankedPlayerRow, column: StatColumn): string {
  if (column.key === "adp") {
    return formatStatValue(getAdp(row.stats), column.decimals);
  }

  if (column.key === "fantasy_pts") {
    return formatStatValue(getFantasyPts(row), column.decimals);
  }

  return formatStatValue(row.stats[column.key], column.decimals);
}

function DraftRosterSection({
  section,
  pickByPlayerId,
  leagueSlug,
}: {
  section: TeamStatsSection;
  pickByPlayerId: Record<string, number>;
  leagueSlug?: string | null;
}) {
  const statColumns = getStatColumns(section.columnPosition);
  const colSpan = 4 + statColumns.length;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">
        {section.title}{" "}
        <span className="text-muted-foreground">
          ({section.players.length})
        </span>
      </h2>
      <TableShell>
        <TooltipProvider>
          <Table className="table-fixed min-w-[44rem]">
            <colgroup>
              <col style={{ width: PLAYER_COLUMN_WIDTH }} />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={PLAYER_COLUMN_CLASS}>
                  <TeamTableColumnHeader title="Player" />
                </TableHead>
                <TableHead className="w-16">
                  <TeamTableColumnHeader
                    title={PLAYER_STAT_COLUMNS.pick.header}
                    tooltip={PLAYER_STAT_COLUMNS.pick.tooltip}
                  />
                </TableHead>
                <TableHead>
                  <TeamTableColumnHeader title="Opp" tooltip="Opponent" />
                </TableHead>
                <TableHead>
                  <TeamTableColumnHeader
                    title={PLAYER_STAT_COLUMNS.rank.header}
                    tooltip={PLAYER_STAT_COLUMNS.rank.tooltip}
                  />
                </TableHead>
                {statColumns.map((column) => (
                  <TableHead key={column.key}>
                    <TeamTableColumnHeader
                      title={column.header}
                      tooltip={column.tooltip}
                    />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.players.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colSpan} className="p-0">
                    <Empty className="py-8">
                      <EmptyHeader>
                        <EmptyDescription>
                          No {section.title.toLowerCase()} drafted yet.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                section.players.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell className={PLAYER_COLUMN_CLASS}>
                      <PlayerIdentity
                        fullName={player.fullName}
                        sleeperId={player.sleeperId}
                        primaryPositionId={player.primaryPositionId}
                        nflTeam={player.nflTeam}
                        byeWeek={player.byeWeek}
                        injuryStatus={player.injuryStatus}
                        playerId={player.id}
                        leagueSlug={leagueSlug}
                      />
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {pickByPlayerId[player.id] ?? PLACEHOLDER}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {PLACEHOLDER}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-medium tabular-nums",
                        getPositionRankColorClass(player.positionRank),
                      )}
                    >
                      {formatPositionRank(
                        player.primaryPositionId,
                        player.positionRank,
                      )}
                    </TableCell>
                    {statColumns.map((column) => (
                      <TableCell key={column.key} className="tabular-nums">
                        {renderStatCell(player, column)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TooltipProvider>
      </TableShell>
    </section>
  );
}

export function DraftRosterTab({
  players,
  pickByPlayerId,
  leagueSlug,
}: DraftRosterTabProps) {
  const sections = groupRosterPlayersForStats(players);

  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <DraftRosterSection
          key={section.id}
          section={section}
          pickByPlayerId={pickByPlayerId}
          leagueSlug={leagueSlug}
        />
      ))}
    </div>
  );
}
