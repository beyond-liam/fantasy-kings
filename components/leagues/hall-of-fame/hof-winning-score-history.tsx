import Link from "next/link";

import { HofSeasonFilter } from "@/components/leagues/hall-of-fame/hof-season-filter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
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
import type { HofWinningScoreHistoryRow } from "@/lib/queries/hof-winning-score-history";
import { formatPoints, teamInitials } from "@/lib/leagues/standings";
import { cn } from "@/lib/utils";

function TeamCell({
  row,
  leagueSlug,
}: {
  row: HofWinningScoreHistoryRow;
  leagueSlug: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar size="sm" className="size-6">
        {row.logoUrl ? <AvatarImage src={row.logoUrl} alt="" /> : null}
        <AvatarFallback className="text-[10px]">
          {teamInitials(row.teamName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <Link
          href={
            row.teamPublicId
              ? `/league/${leagueSlug}/team/${row.teamPublicId}`
              : `/league/${leagueSlug}`
          }
          className="block truncate font-medium underline-offset-2 hover:underline"
        >
          {row.teamName}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{row.ownerName}</p>
      </div>
    </div>
  );
}

function resultClass(result: HofWinningScoreHistoryRow["result"]) {
  if (result === "W") return "text-success";
  if (result === "L") return "text-destructive";
  return "text-muted-foreground";
}

export function HofWinningScoreHistoryTable({
  leagueSlug,
  years,
  selectedYear,
  rows,
}: {
  leagueSlug: string;
  years: number[];
  selectedYear: number | null;
  rows: HofWinningScoreHistoryRow[];
}) {
  if (rows.length === 0) {
    return (
      <Empty size="sm">
        <EmptyHeader>
          <EmptyTitle>No scores yet</EmptyTitle>
          <EmptyDescription>
            {selectedYear == null
              ? "Final scores across every season will show up here."
              : "Final scores for this season will show up here."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <HofSeasonFilter years={years} value={selectedYear} />
      </div>
      <TableShell className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-14">#</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="w-20">Season</TableHead>
              <TableHead className="w-16">Week</TableHead>
              <TableHead>Opponent</TableHead>
              <TableHead className="w-28 text-right">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${row.seasonYear}-${row.week}-${row.teamId}-${index}`}>
                <TableCell className="tabular-nums font-medium">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <TeamCell row={row} leagueSlug={leagueSlug} />
                </TableCell>
                <TableCell className="tabular-nums">{row.seasonYear}</TableCell>
                <TableCell className="tabular-nums">{row.week}</TableCell>
                <TableCell>{row.opponentName}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  <span className={cn("font-semibold", resultClass(row.result))}>
                    {row.result}
                  </span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span>{formatPoints(row.value)}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  );
}
