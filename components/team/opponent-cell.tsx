"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import {
  PositionalSosDifficultyIcon,
  SosMatchupTooltipBody,
} from "@/components/players/sos-matchup-tooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { nflGamePath, type PlayerOpponent } from "@/lib/nfl/matchups";
import { formatPositionalSosTooltip } from "@/lib/players/matchup-difficulty";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "—";

type OpponentCellProps = {
  opponent?: PlayerOpponent | string | null;
  className?: string;
};

function normalizeOpponent(
  opponent: OpponentCellProps["opponent"],
): PlayerOpponent | null {
  if (!opponent) {
    return null;
  }
  if (typeof opponent === "string") {
    return {
      label: opponent,
      abbrev: null,
      kickoffLabel: null,
      gameStatus: null,
      hasPossession: false,
      inRedZone: false,
      gameId: null,
    };
  }
  return opponent;
}

export function OpponentCell({
  opponent,
  className,
}: OpponentCellProps) {
  const value = normalizeOpponent(opponent);

  if (!value) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        {PLACEHOLDER}
      </span>
    );
  }

  const matchup = value.matchup ?? null;
  const gameStarted =
    value.gameStatus === "in" || value.gameStatus === "post";
  const tooltip =
    matchup && !gameStarted
      ? formatPositionalSosTooltip({
          opponentLabel: value.label,
          matchup,
        })
      : null;
  const href = value.gameId ? nflGamePath(value.gameId) : null;

  const label = (
    <span className="leading-tight text-foreground tabular-nums">
      {value.label}
    </span>
  );

  const kickoff = value.kickoffLabel ? (
    <span
      className={cn(
        "whitespace-nowrap text-[11px] leading-tight tabular-nums",
        value.gameStatus === "in"
          ? "text-success"
          : "text-muted-foreground",
      )}
    >
      {value.kickoffLabel}
    </span>
  ) : null;

  const inner = (
    <>
      <span className="inline-flex w-fit max-w-full items-center gap-1.5">
        {label}
        {tooltip && matchup ? (
          <PositionalSosDifficultyIcon difficulty={matchup.difficulty} />
        ) : null}
      </span>
      {kickoff}
    </>
  );

  const triggerClassName =
    "flex w-fit max-w-full flex-col gap-1 rounded-sm outline-none transition-transform active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-ring [.text-right]:items-end";

  const ariaLabel = [
    href ? `${value.label} NFL matchup` : value.label,
    tooltip
      ? `${tooltip.headline} Matchup rank ${tooltip.rankValue}. Fantasy pts allowed ${tooltip.ptsValue}.`
      : null,
  ]
    .filter(Boolean)
    .join(". ");

  let body: ReactNode;
  if (tooltip && matchup) {
    const trigger = href ? (
      <Link href={href} className={triggerClassName} aria-label={ariaLabel} />
    ) : (
      <button
        type="button"
        className={triggerClassName}
        aria-label={ariaLabel}
      />
    );
    body = (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={trigger}>{inner}</TooltipTrigger>
          <TooltipContent className="relative max-w-[16rem] flex-col items-stretch gap-0 p-0">
            <SosMatchupTooltipBody
              headline={tooltip.headline}
              rankValue={tooltip.rankValue}
              ptsValue={tooltip.ptsValue}
              footnote={tooltip.footnote}
            />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  } else if (href) {
    body = (
      <Link href={href} className={triggerClassName} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  } else {
    body = inner;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1 [.text-right]:items-end",
        className,
      )}
    >
      {body}
    </div>
  );
}
