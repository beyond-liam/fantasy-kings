"use client";

import { LicenseDraftIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerProfileTrigger } from "@/components/rankings/player-identity";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
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

export type TeamDraftPickRow = {
  overall: number;
  playerId: string;
  playerName: string;
  positionId: string;
  nflTeam: string | null;
};

type TeamDraftPicksListProps = {
  picks: TeamDraftPickRow[];
  leagueSlug?: string | null;
};

export function TeamDraftPicksList({
  picks,
  leagueSlug,
}: TeamDraftPicksListProps) {
  if (picks.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={LicenseDraftIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>No draft picks yet</EmptyTitle>
          <EmptyDescription>
            Players drafted by this team will show up here after the draft.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Pick</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="w-24">Pos</TableHead>
            <TableHead className="w-24">Team</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {picks.map((pick) => (
            <TableRow key={pick.overall}>
              <TableCell className="tabular-nums">{pick.overall}</TableCell>
              <TableCell className="font-medium">
                <PlayerProfileTrigger
                  playerId={pick.playerId}
                  leagueSlug={leagueSlug}
                  aria-label={`View ${pick.playerName}`}
                  className="underline-offset-2 group-hover/player-identity:underline group-focus-visible/player-identity:underline"
                >
                  {pick.playerName}
                </PlayerProfileTrigger>
              </TableCell>
              <TableCell>{pick.positionId}</TableCell>
              <TableCell className="text-muted-foreground">
                {pick.nflTeam ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}
