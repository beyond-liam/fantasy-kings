"use client";

import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRecord, teamInitials } from "@/lib/leagues/standings";
import type { GameCentreTeamSide } from "@/lib/queries/game-centre";
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

function WinChanceMeter({
  chance,
  growFrom,
  align,
  muted,
  yetToPlay,
}: {
  chance: number | null;
  growFrom: "end" | "start";
  align: "away" | "home";
  muted: boolean;
  yetToPlay: number;
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
  const yetLabel = `Yet to play (${yetToPlay})`;

  // % near VS (fill origin); "Yet to play" on the outer end.
  const meta = (
    <div
      className={cn(
        "flex w-full items-center gap-2 text-xs tabular-nums",
        align === "away" ? "justify-between" : "justify-between flex-row-reverse",
      )}
    >
      <span className="text-muted-foreground">{yetLabel}</span>
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
          isAway ? "flex-row" : "flex-row-reverse",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5",
            isAway ? "flex-row" : "flex-row-reverse",
          )}
        >
          <Avatar size="lg" className="shrink-0">
            {side.logoUrl ? <AvatarImage src={side.logoUrl} alt="" /> : null}
            <AvatarFallback>{teamInitials(side.teamName)}</AvatarFallback>
          </Avatar>
          <div
            className={cn(
              "flex min-w-0 flex-col",
              isAway ? "text-left" : "text-right",
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
            "shrink-0 tabular-nums",
            isAway ? "text-right" : "text-left",
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

      <WinChanceMeter
        chance={side.winChance}
        growFrom={isAway ? "end" : "start"}
        align={align}
        muted={muted}
        yetToPlay={side.yetToPlay}
      />
    </div>
  );
}

type MatchupHeaderProps = {
  away: GameCentreTeamSide;
  home: GameCentreTeamSide;
  onProjectedClick?: () => void;
};

export function MatchupHeader({
  away,
  home,
  onProjectedClick,
}: MatchupHeaderProps) {
  return (
    <div className="relative flex min-w-0 items-stretch overflow-hidden rounded-xl border bg-card">
      <HeaderSide
        side={away}
        align="away"
        onProjectedClick={away.isViewerTeam ? onProjectedClick : undefined}
      />
      <div className="relative z-10 flex shrink-0 items-center self-center">
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
