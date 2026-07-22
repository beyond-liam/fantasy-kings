"use client";

import Link from "next/link";

import { TeamTableColumnHeader } from "@/components/team/team-table-column-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TABLE_ENTITY_LINK_CLASSNAME,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { resolveDraftListStatus } from "@/lib/leagues/draft-status";
import { formatWinPct, teamInitials } from "@/lib/leagues/standings";
import type { UserLeagueListItem } from "@/lib/queries/leagues";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "—";

const CELL_PAD = "px-4 py-3.5";

const STAT_HEADERS = [
  { id: "w", title: "W", tooltip: "Wins", className: "w-12" },
  { id: "l", title: "L", tooltip: "Losses", className: "w-12" },
  { id: "t", title: "T", tooltip: "Ties", className: "w-12" },
  { id: "pct", title: "%", tooltip: "Win percentage", className: "w-14" },
  { id: "strk", title: "Strk", tooltip: "Streak", className: "w-14" },
  { id: "rank", title: "Rank", tooltip: "Rank", className: "w-14" },
] as const;

type LeaguesTableProps = {
  leagues: UserLeagueListItem[];
};

function DraftStatusCell({ league }: { league: UserLeagueListItem }) {
  const draft = resolveDraftListStatus({
    status: league.draftStatus,
    draftStartAt: league.draftStartAt,
    draftType: league.draftType,
  });

  return (
    <span
      className={cn(
        draft.kind === "in_progress" && "text-warning",
        (draft.kind === "unscheduled" || draft.kind === "complete") &&
          "text-muted-foreground",
      )}
    >
      {draft.label}
    </span>
  );
}

export function LeaguesTable({ leagues }: LeaguesTableProps) {
  return (
    <Card size="sm" className="gap-0 py-0">
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={CELL_PAD}>League</TableHead>
              {STAT_HEADERS.map((header, index) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    CELL_PAD,
                    "text-center",
                    header.className,
                    index === 0 && "border-l",
                  )}
                >
                  <TeamTableColumnHeader
                    title={header.title}
                    tooltip={header.tooltip}
                  />
                </TableHead>
              ))}
              <TableHead className={cn(CELL_PAD, "border-l")}>Draft</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leagues.map((league) => {
              const teamName = league.teamName ?? "No team";
              const streak = league.streak?.trim() || PLACEHOLDER;
              const rank =
                league.rank != null ? String(league.rank) : PLACEHOLDER;

              return (
                <TableRow key={league.id} className="group">
                  <TableCell className={CELL_PAD}>
                    <Link
                      href={`/league/${league.publicId}`}
                      className="flex min-w-0 items-center gap-3"
                    >
                      <Avatar size="lg" className="size-10 shrink-0 text-xs">
                        {league.logoUrl ? (
                          <AvatarImage src={league.logoUrl} alt="" />
                        ) : null}
                        <AvatarFallback>
                          {teamInitials(league.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex min-w-0 flex-col gap-0">
                        <span
                          className={cn(
                            TABLE_ENTITY_LINK_CLASSNAME,
                            "tracking-tight group-hover:underline",
                          )}
                        >
                          {league.name}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {teamName}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell
                    className={cn(
                      CELL_PAD,
                      "border-l text-center tabular-nums",
                    )}
                  >
                    {league.wins}
                  </TableCell>
                  <TableCell
                    className={cn(CELL_PAD, "text-center tabular-nums")}
                  >
                    {league.losses}
                  </TableCell>
                  <TableCell
                    className={cn(CELL_PAD, "text-center tabular-nums")}
                  >
                    {league.ties}
                  </TableCell>
                  <TableCell
                    className={cn(CELL_PAD, "text-center tabular-nums")}
                  >
                    {formatWinPct(league.winPct)}
                  </TableCell>
                  <TableCell
                    className={cn(CELL_PAD, "text-center tabular-nums")}
                  >
                    {streak}
                  </TableCell>
                  <TableCell
                    className={cn(CELL_PAD, "text-center tabular-nums")}
                  >
                    {rank}
                  </TableCell>
                  <TableCell
                    className={cn(CELL_PAD, "border-l whitespace-nowrap")}
                  >
                    <DraftStatusCell league={league} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TooltipProvider>
    </Card>
  );
}
