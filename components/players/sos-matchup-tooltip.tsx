"use client";

import {
  FullSignalIcon,
  LowSignalIcon,
  MediumSignalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { SosMatchupBucketId } from "@/lib/players/sos-thresholds";
import { cn } from "@/lib/utils";

export function PositionalSosDifficultyIcon({
  difficulty,
  className,
}: {
  difficulty: SosMatchupBucketId;
  className?: string;
}) {
  const icon =
    difficulty === "easy"
      ? FullSignalIcon
      : difficulty === "hard"
        ? LowSignalIcon
        : MediumSignalIcon;
  const tone =
    difficulty === "easy"
      ? "text-success"
      : difficulty === "hard"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <HugeiconsIcon
      icon={icon}
      strokeWidth={1.25}
      aria-hidden
      className={cn("size-3 shrink-0", tone, className)}
    />
  );
}

export function SosMatchupTooltipBody({
  headline,
  rankValue,
  ptsValue,
  footnote,
}: {
  headline: string;
  rankValue: string;
  ptsValue: string;
  footnote: string;
}) {
  return (
    <>
      <p className="px-3 py-1.5 text-pretty font-semibold">{headline}</p>
      <dl className="flex flex-col gap-1 border-y border-background/15 px-3 py-1.5">
        <div className="flex justify-between gap-4">
          <dt className="text-background/70">Matchup rank</dt>
          <dd className="font-medium tabular-nums">{rankValue}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-background/70">Fantasy pts allowed</dt>
          <dd className="font-medium tabular-nums">{ptsValue}</dd>
        </div>
      </dl>
      <p className="px-3 py-1.5 text-[10px] text-background/70">{footnote}</p>
    </>
  );
}
