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
import type { HofTeamCountHistoryRow } from "@/lib/queries/hof-winning-score-history";
import { teamInitials } from "@/lib/leagues/standings";

function TeamCell({
  row,
  leagueSlug,
}: {
  row: HofTeamCountHistoryRow;
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

export function HofTeamCountHistoryTable({
  leagueSlug,
  years,
  selectedYear,
  rows,
  emptyTitle,
  emptyDescription,
  countLabel,
}: {
  leagueSlug: string;
  years: number[];
  selectedYear: number | null;
  rows: HofTeamCountHistoryRow[];
  emptyTitle: string;
  emptyDescription: string;
  countLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <Empty size="sm">
        <EmptyHeader>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
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
              <TableHead className="w-28 text-right">{countLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${row.seasonYear}-${row.teamId}-${index}`}>
                <TableCell className="tabular-nums font-medium">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <TeamCell row={row} leagueSlug={leagueSlug} />
                </TableCell>
                <TableCell className="tabular-nums">{row.seasonYear}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {row.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  );
}
