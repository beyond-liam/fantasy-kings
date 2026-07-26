import Link from "next/link";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import type {
  HofChampionshipSeason,
  HofRegularSeasonTitle,
  HofTitleTeam,
} from "@/lib/leagues/hof-title-history";
import { formatTitleRecord } from "@/lib/leagues/hof-title-history";
import { teamInitials } from "@/lib/leagues/standings";

function TeamCell({
  team,
  leagueSlug,
}: {
  team: HofTitleTeam;
  leagueSlug: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar size="sm" className="size-6">
        {team.logoUrl ? <AvatarImage src={team.logoUrl} alt="" /> : null}
        <AvatarFallback className="text-[10px]">
          {teamInitials(team.teamName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <Link
          href={
            team.teamPublicId
              ? `/league/${leagueSlug}/team/${team.teamPublicId}`
              : `/league/${leagueSlug}`
          }
          className="block truncate font-medium underline-offset-2 hover:underline"
        >
          {team.teamName}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{team.ownerName}</p>
      </div>
    </div>
  );
}

export function HofTitlePageHeader({
  title,
  leagueSlug,
  description,
}: {
  title: string;
  leagueSlug: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Button
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="w-fit px-2"
        render={
          <Link href={`/league/${leagueSlug}?tab=hall-of-fame`} />
        }
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Hall of Fame
      </Button>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function HofChampionshipsTable({
  leagueSlug,
  rows,
}: {
  leagueSlug: string;
  rows: HofChampionshipSeason[];
}) {
  const crowned = rows.filter((row) => row.champion);
  if (crowned.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No champions yet</EmptyTitle>
          <EmptyDescription>
            League titles appear here once a championship is finalized.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <TableShell className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-24">Season</TableHead>
            <TableHead>Champion</TableHead>
            <TableHead>Runner-up</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {crowned.map((row) => (
            <TableRow key={row.seasonYear}>
              <TableCell className="tabular-nums font-medium">
                {row.seasonYear}
              </TableCell>
              <TableCell>
                {row.champion ? (
                  <TeamCell team={row.champion} leagueSlug={leagueSlug} />
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {row.runnerUp ? (
                  <TeamCell team={row.runnerUp} leagueSlug={leagueSlug} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}

export function HofRegularSeasonTitlesTable({
  leagueSlug,
  rows,
}: {
  leagueSlug: string;
  rows: HofRegularSeasonTitle[];
}) {
  if (rows.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No regular season champions yet</EmptyTitle>
          <EmptyDescription>
            The #1 regular-season finish each year will show up here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <TableShell className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-24">Season</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Record</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.seasonYear}>
              <TableCell className="tabular-nums font-medium">
                {row.seasonYear}
              </TableCell>
              <TableCell>
                <TeamCell team={row.team} leagueSlug={leagueSlug} />
              </TableCell>
              <TableCell className="text-sm tabular-nums text-muted-foreground">
                {formatTitleRecord(row)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}
