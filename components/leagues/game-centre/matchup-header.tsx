"use client";

import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MatchupStatusBadge } from "@/components/leagues/matchups/matchup-status-badge";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatKickoffDay, formatKickoffTime } from "@/lib/nfl/schedule-week";
import { formatRecord, teamInitials } from "@/lib/leagues/standings";
import type {
  GameCentreTeamSide,
  GameCentreYetToPlayPlayer,
} from "@/lib/queries/game-centre";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "—";
const CHANCE_ANIM_MS = 750;

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useChanceEntrance(targetPct: number | null) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (targetPct == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the rAF-driven animation state before (re)starting the entrance animation loop below.
      setProgress(0);
      return;
    }
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }

    setProgress(0);
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const raw = Math.min(1, (now - start) / CHANCE_ANIM_MS);
      setProgress(easeOutCubic(raw));
      if (raw < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [targetPct]);

  return progress;
}

function formatPts(value: number | null, digits = 2) {
  if (value == null || !Number.isFinite(value)) return PLACEHOLDER;
  return value.toFixed(digits);
}

function YetToPlayLabel({
  yetToPlay,
  players,
}: {
  yetToPlay: number;
  players: GameCentreYetToPlayPlayer[];
}) {
  const label = `Yet to play (${yetToPlay})`;
  if (yetToPlay === 0 || players.length === 0) {
    return <span className="text-muted-foreground">{label}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        }
      >
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-0 overflow-hidden p-0">
        <PopoverHeader className="border-b px-3 py-2">
          <PopoverTitle className="text-xs font-medium text-muted-foreground">
            Still to play
          </PopoverTitle>
        </PopoverHeader>
        <ul className="flex flex-col gap-1.5 px-3 py-2">
          {players.map((player) => {
            const kickoff = player.kickoff ? new Date(player.kickoff) : null;
            const when =
              kickoff && Number.isFinite(kickoff.getTime())
                ? `${formatKickoffDay(kickoff)} ${formatKickoffTime(kickoff)}`
                : null;
            return (
              <li key={player.id} className="flex flex-col gap-0.5 text-xs">
                <span>
                  {player.fullName}{" "}
                  <span className="tabular-nums text-muted-foreground">
                    {player.slotPositionId}
                  </span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {[player.opponentLabel, when].filter(Boolean).join(" · ") ||
                    "Kickoff TBD"}
                </span>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function WinChanceMeter({
  chance,
  growFrom,
  align,
  muted,
  yetToPlay,
  yetToPlayPlayers,
}: {
  chance: number | null;
  growFrom: "end" | "start";
  align: "away" | "home";
  muted: boolean;
  yetToPlay: number;
  yetToPlayPlayers: GameCentreYetToPlayPlayer[];
}) {
  const targetPct =
    chance != null && Number.isFinite(chance)
      ? Math.max(0, Math.min(100, Math.round(chance * 100)))
      : null;
  const progress = useChanceEntrance(targetPct);
  const displayPct =
    targetPct == null ? null : Math.round(progress * targetPct);
  const scale = targetPct == null ? 0 : (progress * targetPct) / 100;
  const fillTone =
    chance == null
      ? "bg-muted-foreground/40"
      : chance >= 0.55
        ? "bg-success"
        : chance <= 0.45
          ? "bg-destructive"
          : "bg-muted-foreground";

  const pctLabel = displayPct == null ? PLACEHOLDER : `${displayPct}%`;

  // % near VS (fill origin); "Yet to play" on the outer end.
  const meta = (
    <div
      className={cn(
        "flex w-full items-center gap-2 text-xs tabular-nums",
        align === "away" ? "justify-between" : "justify-between flex-row-reverse",
      )}
    >
      <YetToPlayLabel yetToPlay={yetToPlay} players={yetToPlayPlayers} />
      <span
        className={cn(
          muted ? "text-muted-foreground/70" : null,
          !muted && chance != null && chance >= 0.55 && "text-success",
          !muted && chance != null && chance <= 0.45 && "text-destructive",
          !muted &&
            (chance == null || (chance > 0.45 && chance < 0.55)) &&
            "text-muted-foreground",
        )}
      >
        {pctLabel}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={displayPct ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Win chance"
      >
        <div
          className={cn(
            "h-full w-full rounded-full",
            growFrom === "end" ? "origin-right" : "origin-left",
            fillTone,
          )}
          style={{ transform: `scaleX(${scale})` }}
        />
      </div>
      {meta}
    </div>
  );
}

function HeaderSide({
  side,
  align,
  onProjectedClick,
}: {
  side: GameCentreTeamSide;
  align: "away" | "home";
  onProjectedClick?: () => void;
}) {
  const isAway = align === "away";
  const muted = side.isLoser;
  const projectedInteractive = Boolean(onProjectedClick && side.isViewerTeam);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 py-3 sm:px-4">
      <div
        className={cn(
          "flex min-w-0 items-center gap-2.5",
          isAway ? "flex-row" : "flex-row md:flex-row-reverse",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5",
            isAway ? "flex-row" : "flex-row md:flex-row-reverse",
          )}
        >
          <Avatar size="lg" className="shrink-0">
            {side.logoUrl ? <AvatarImage src={side.logoUrl} alt="" /> : null}
            <AvatarFallback>{teamInitials(side.teamName)}</AvatarFallback>
          </Avatar>
          <div
            className={cn(
              "flex min-w-0 flex-col text-left",
              !isAway && "md:text-right",
            )}
          >
            <span
              className={cn(
                "truncate text-base font-semibold",
                muted ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {side.teamName}
            </span>
            <span className="truncate text-xs tabular-nums text-muted-foreground">
              {formatRecord(side.wins, side.losses, side.ties)}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "shrink-0 text-right tabular-nums",
            !isAway && "md:text-left",
            muted && "text-muted-foreground",
          )}
        >
          <div
            className={cn(
              "text-lg font-semibold leading-none tracking-tight sm:text-xl",
              muted && "text-muted-foreground",
            )}
          >
            {formatPts(side.actualPts, 1)}
          </div>
          {projectedInteractive ? (
            <button
              type="button"
              onClick={onProjectedClick}
              className="mt-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {formatPts(side.projectedPts)}
            </button>
          ) : (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {formatPts(side.projectedPts)}
            </div>
          )}
        </div>
      </div>

      {/* Stacked mobile: Yet to play left, % right. Desktop keeps mirrored layout. */}
      <div className="md:hidden">
        <WinChanceMeter
          chance={side.winChance}
          growFrom="start"
          align="away"
          muted={muted}
          yetToPlay={side.yetToPlay}
          yetToPlayPlayers={side.yetToPlayPlayers}
        />
      </div>
      <div className="hidden md:block">
        <WinChanceMeter
          chance={side.winChance}
          growFrom={isAway ? "end" : "start"}
          align={align}
          muted={muted}
          yetToPlay={side.yetToPlay}
          yetToPlayPlayers={side.yetToPlayPlayers}
        />
      </div>
    </div>
  );
}

type MatchupHeaderProps = {
  away: GameCentreTeamSide;
  home: GameCentreTeamSide;
  status: "scheduled" | "in_progress" | "final";
  onProjectedClick?: () => void;
};

export function MatchupHeader({
  away,
  home,
  status,
  onProjectedClick,
}: MatchupHeaderProps) {
  return (
    <div className="relative flex min-w-0 flex-col items-stretch overflow-hidden rounded-xl border bg-card pt-7 md:flex-row">
      <span className="pointer-events-none absolute inset-x-0 top-1.5 z-20 flex justify-center">
        <MatchupStatusBadge status={status} />
      </span>
      <div className="border-b border-border md:contents md:border-0">
        <HeaderSide
          side={away}
          align="away"
          onProjectedClick={away.isViewerTeam ? onProjectedClick : undefined}
        />
      </div>
      <div className="relative z-10 hidden shrink-0 items-center self-center md:flex">
        <span className="flex size-8 items-center justify-center rounded-full border bg-background text-[10px] font-semibold tracking-wide text-muted-foreground">
          VS
        </span>
      </div>
      <HeaderSide
        side={home}
        align="home"
        onProjectedClick={home.isViewerTeam ? onProjectedClick : undefined}
      />
    </div>
  );
}
