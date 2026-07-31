"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { LicenseDraftIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { DraftPickRow } from "@/lib/queries/draft";
import type { DraftScheduleSlot } from "@/lib/leagues/draft/board";
import { positionToneClass } from "@/lib/leagues/position-colors";
import { teamInitials } from "@/lib/leagues/standings";
import { resolvePlayerByeWeek } from "@/lib/nfl/bye-weeks";
import { cn } from "@/lib/utils";

const PlayerProfileDialog = dynamic(
  () =>
    import("@/components/players/player-profile-dialog").then(
      (m) => m.PlayerProfileDialog,
    ),
  { ssr: false },
);

type DraftBoardProps = {
  slug: string;
  schedule: DraftScheduleSlot[];
  picks: DraftPickRow[];
  teams: Array<{
    id: string;
    name: string;
    draftSlot: number;
    logoUrl?: string | null;
  }>;
  rounds: number;
  currentPickIndex: number;
  status: "scheduled" | "live" | "paused" | "complete" | null;
};

function shortName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  return `${parts[0]![0]}. ${parts.slice(1).join(" ")}`;
}

export function DraftBoard({
  slug,
  schedule,
  picks,
  teams,
  rounds,
  currentPickIndex,
  status,
}: DraftBoardProps) {
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const pickByOverall = new Map(picks.map((pick) => [pick.overall, pick]));
  const orderedTeams = [...teams].sort((a, b) => a.draftSlot - b.draftSlot);

  if (orderedTeams.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={LicenseDraftIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>No draft board yet</EmptyTitle>
          <EmptyDescription>
            Add teams and set draft order to see the board.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const rows = Array.from({ length: rounds }, (_, index) => index + 1);
  const columnWidth = "9rem";

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card/40">
        <table className="w-max min-w-full table-fixed border-collapse text-sm">
          <colgroup>
            {orderedTeams.map((team) => (
              <col key={team.id} style={{ width: columnWidth }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border/80">
              {orderedTeams.map((team) => (
                <th
                  key={team.id}
                  className="overflow-hidden px-1.5 py-3 text-center font-medium"
                  style={{ width: columnWidth, maxWidth: columnWidth }}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <Avatar size="sm" className="shrink-0">
                      {team.logoUrl ? (
                        <AvatarImage src={team.logoUrl} alt="" />
                      ) : null}
                      <AvatarFallback>{teamInitials(team.name)}</AvatarFallback>
                    </Avatar>
                    <span className="line-clamp-2 w-full truncate text-[11px] leading-tight">
                      {team.name}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((round) => {
              const roundSlots = schedule.filter((slot) => slot.round === round);
              const byTeam = new Map(
                roundSlots.map((slot) => [slot.teamId, slot]),
              );

              return (
                <tr
                  key={round}
                  className="border-b border-border/60 last:border-b-0"
                >
                  {orderedTeams.map((team) => {
                    const slot = byTeam.get(team.id);
                    if (!slot) {
                      return (
                        <td
                          key={team.id}
                          className="overflow-hidden p-1 align-middle"
                          style={{ width: columnWidth, maxWidth: columnWidth }}
                        >
                          <div className="flex h-14 w-full items-center justify-center rounded-md bg-muted/20 text-xs text-muted-foreground">
                            —
                          </div>
                        </td>
                      );
                    }

                    const pick = pickByOverall.get(slot.overall);
                    const isOnClock =
                      (status === "live" || status === "paused") &&
                      slot.overall - 1 === currentPickIndex;
                    const bye = pick
                      ? resolvePlayerByeWeek({
                          byeWeek: pick.playerByeWeek,
                          nflTeam: pick.playerNflTeam,
                        })
                      : null;

                    const cellClass = cn(
                      "relative flex h-14 w-full min-w-0 items-center overflow-hidden rounded-md px-1.5 py-1 pr-5 ring-1 ring-inset transition-colors",
                      pick
                        ? positionToneClass(pick.playerPositionId)
                        : "bg-muted/15 text-muted-foreground ring-border/40",
                      isOnClock && "bg-muted/50 text-foreground",
                      pick &&
                        "cursor-pointer hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    );

                    const cellInner = (
                      <>
                        <span className="absolute top-1.5 right-1.5 text-[9px] leading-none tabular-nums opacity-55">
                          {slot.overall}
                        </span>
                        {isOnClock && !pick ? (
                          <p className="w-full truncate px-0.5 text-center text-[10px] font-semibold leading-tight tracking-tight">
                            On the clock
                          </p>
                        ) : pick ? (
                          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                            <PlayerAvatar
                              fullName={pick.playerFullName}
                              sleeperId={pick.playerSleeperId}
                              primaryPositionId={pick.playerPositionId}
                              nflTeam={pick.playerNflTeam}
                              size="sm"
                              className="size-7 shrink-0"
                            />
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <p className="truncate text-[11px] font-semibold leading-tight">
                                {shortName(pick.playerFullName)}
                              </p>
                              <p className="truncate text-[10px] opacity-80">
                                {pick.playerNflTeam
                                  ? `${pick.playerPositionId} · ${pick.playerNflTeam}${
                                      bye != null ? ` (${bye})` : ""
                                    }`
                                  : pick.playerPositionId}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </>
                    );

                    return (
                      <td
                        key={team.id}
                        className="overflow-hidden p-1 align-middle"
                        style={{ width: columnWidth, maxWidth: columnWidth }}
                      >
                        {pick ? (
                          <button
                            type="button"
                            className={cellClass}
                            onClick={() => setProfilePlayerId(pick.playerId)}
                            aria-label={`View ${pick.playerFullName}`}
                          >
                            {cellInner}
                          </button>
                        ) : (
                          <div className={cellClass}>{cellInner}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PlayerProfileDialog
        playerId={profilePlayerId}
        leagueSlug={slug}
        open={profilePlayerId != null}
        onOpenChange={(open) => {
          if (!open) setProfilePlayerId(null);
        }}
      />
    </>
  );
}
