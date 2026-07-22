"use client";

import { useState, type MouseEvent } from "react";

import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { PlayerProfileDialog } from "@/components/players/player-profile-dialog";
import { resolvePlayerByeWeek } from "@/lib/nfl/bye-weeks";
import { cn } from "@/lib/utils";

type PlayerIdentityProps = {
  fullName: string;
  sleeperId?: string | null;
  primaryPositionId: string;
  nflTeam?: string | null;
  byeWeek?: number | null;
  injuryStatus?: string | null;
  record?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
  /** When set, name/avatar open the player profile dialog. */
  playerId?: string | null;
  leagueSlug?: string | null;
};

export function formatPlayerSubtitle({
  primaryPositionId,
  nflTeam,
  byeWeek,
  record,
}: {
  primaryPositionId: string;
  nflTeam?: string | null;
  byeWeek?: number | null;
  record?: string | null;
}) {
  const resolvedBye = resolvePlayerByeWeek({ byeWeek, nflTeam });
  const teamBye = nflTeam
    ? `${nflTeam}${resolvedBye != null ? ` (${resolvedBye})` : ""}`
    : null;
  const base = teamBye
    ? `${primaryPositionId} - ${teamBye}`
    : primaryPositionId;

  return record ? `${base} · ${record}` : base;
}

export function PlayerIdentity({
  fullName,
  sleeperId,
  primaryPositionId,
  nflTeam,
  byeWeek,
  injuryStatus,
  record,
  size = "sm",
  className,
  playerId,
  leagueSlug,
}: PlayerIdentityProps) {
  const [open, setOpen] = useState(false);
  const subtitle = formatPlayerSubtitle({
    primaryPositionId,
    nflTeam,
    byeWeek,
    record,
  });

  const content = (
    <>
      <PlayerAvatar
        fullName={fullName}
        sleeperId={sleeperId}
        primaryPositionId={primaryPositionId}
        nflTeam={nflTeam}
        injuryStatus={injuryStatus}
        size={size}
      />
      <div className="flex min-w-0 flex-col">
        <span
          className={cn(
            "truncate font-medium underline-offset-2",
            playerId &&
              "group-hover/player-identity:underline group-focus-visible/player-identity:underline",
          )}
        >
          {fullName}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {subtitle}
        </span>
      </div>
    </>
  );

  if (!playerId) {
    return (
      <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
        {content}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          "group/player-identity flex min-w-0 items-center gap-2.5 text-left focus-visible:outline-none",
          className,
        )}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {content}
      </button>
      <PlayerProfileDialog
        playerId={open ? playerId : null}
        leagueSlug={leagueSlug}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function EmptyPlayerIdentity({
  slotLabel,
}: {
  slotLabel: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 text-muted-foreground">
      <div className="size-6 shrink-0 rounded-full bg-muted" aria-hidden />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm">Empty</span>
        <span className="truncate text-xs">{slotLabel}</span>
      </div>
    </div>
  );
}
