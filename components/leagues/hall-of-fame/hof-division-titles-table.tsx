"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import type { HofDivision } from "@/lib/leagues/hall-of-fame";
import type { HofDivisionTitleSeason } from "@/lib/leagues/hof-title-history";
import { formatTitleRecord } from "@/lib/leagues/hof-title-history";
import { teamInitials } from "@/lib/leagues/standings";

export function HofDivisionTitlesTable({
  leagueSlug,
  divisions,
  rows,
  initialDivisionId,
}: {
  leagueSlug: string;
  divisions: HofDivision[];
  rows: HofDivisionTitleSeason[];
  initialDivisionId?: string | null;
}) {
  const sortedDivisions = useMemo(
    () =>
      [...divisions].toSorted(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    [divisions],
  );

  const defaultDivisionId =
    (initialDivisionId &&
      sortedDivisions.some((d) => d.id === initialDivisionId) &&
      initialDivisionId) ||
    sortedDivisions[0]?.id ||
    "";

  const [divisionId, setDivisionId] = useState(defaultDivisionId);

  const divisionItems = sortedDivisions.map((division) => ({
    value: division.id,
    label: division.name,
  }));

  const filtered = rows
    .filter((row) => row.divisionId === divisionId)
    .toSorted((a, b) => b.seasonYear - a.seasonYear);

  if (sortedDivisions.length === 0) {
    return (
      <Empty size="sm">
        <EmptyHeader>
          <EmptyTitle>No divisions</EmptyTitle>
          <EmptyDescription>
            Division titles appear once the league has multiple divisions.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Filter by division
        </p>
        <Select
          items={divisionItems}
          value={divisionId}
          onValueChange={(value) => {
            if (value) setDivisionId(value);
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-48 shrink-0"
            aria-label="Filter division titles"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end" alignItemWithTrigger={false}>
            <SelectGroup>
              {divisionItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Empty size="sm">
          <EmptyHeader>
            <EmptyTitle>No division winners yet</EmptyTitle>
            <EmptyDescription>
              Winners show once regular-season results land for this division.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TableShell className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-24">Season</TableHead>
                <TableHead>Winner</TableHead>
                <TableHead>Record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={`${row.seasonYear}:${row.divisionId}`}>
                  <TableCell className="tabular-nums font-medium">
                    {row.seasonYear}
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar size="sm" className="size-6">
                        {row.team.logoUrl ? (
                          <AvatarImage src={row.team.logoUrl} alt="" />
                        ) : null}
                        <AvatarFallback className="text-[10px]">
                          {teamInitials(row.team.teamName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <Link
                          href={
                            row.team.teamPublicId
                              ? `/league/${leagueSlug}/team/${row.team.teamPublicId}`
                              : `/league/${leagueSlug}`
                          }
                          className="block truncate font-medium underline-offset-2 hover:underline"
                        >
                          {row.team.teamName}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.team.ownerName}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {formatTitleRecord(row)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      )}
    </div>
  );
}
