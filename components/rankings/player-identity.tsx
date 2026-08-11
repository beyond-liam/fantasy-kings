"use client";

import dynamic from "next/dynamic";
import {
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { resolvePlayerByeWeek } from "@/lib/nfl/bye-weeks";
import { cn } from "@/lib/utils";

const PlayerProfileDialog = dynamic(
  () =>
    import("@/components/players/player-profile-dialog").then(
      (m) => m.PlayerProfileDialog,
    ),
  { ssr: false },
);

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

type PlayerProfileTriggerProps = {
  playerId?: string | null;
  leagueSlug?: string | null;
  className?: string;
  children: ReactNode;
  /** Accessible name when the trigger content is not self-describing. */
  "aria-label"?: string;
};

/** Wrap any player name/avatar markup so it opens the profile dialog. */
export function PlayerProfileTrigger({
  playerId,
  leagueSlug,
  className,
  children,
  "aria-label": ariaLabel,
}: PlayerProfileTriggerProps) {
  const [open, setOpen] = useState(false);

  if (!playerId) {
    return <div className={className}>{children}</div>;
  }

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        className={cn(
          "group/player-identity min-w-0 text-left focus-visible:outline-none",
          className,
        )}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {children}
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
  const subtitle = formatPlayerSubtitle({
    primaryPositionId,
    nflTeam,
    byeWeek,
    record,
  });

  return (
    <PlayerProfileTrigger
      playerId={playerId}
      leagueSlug={leagueSlug}
      aria-label={playerId ? `View ${fullName}` : undefined}
      className={cn("flex min-w-0 items-center gap-2.5", className)}
    >
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
    </PlayerProfileTrigger>
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
