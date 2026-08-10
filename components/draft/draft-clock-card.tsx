"use client";

import type { ReactNode } from "react";
import { StopWatchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPickClock } from "@/lib/leagues/draft/clock";
import { cn } from "@/lib/utils";

type DraftClockCardProps = {
  title: string;
  /** Shown under the title, aligned with the title text. */
  subtitle?: ReactNode;
  /** Opposite the heading (e.g. play/pause). */
  headerAction?: ReactNode;
  showStopwatch?: boolean;
  children: ReactNode;
  className?: string;
};

export function DraftClockCard({
  title,
  subtitle,
  headerAction,
  showStopwatch = true,
  children,
  className,
}: DraftClockCardProps) {
  return (
    <Card size="sm" className={cn("min-w-[16rem] gap-0 py-0", className)}>
      <CardHeader variant="panel">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0">
            <div className="flex min-w-0 items-center gap-2">
              {showStopwatch ? (
                <HugeiconsIcon
                  icon={StopWatchIcon}
                  strokeWidth={2}
                  className="size-4 shrink-0"
                />
              ) : null}
              <CardTitle className="min-w-0 text-base leading-none text-balance">
                {title}
              </CardTitle>
            </div>
            {subtitle ? (
              <p
                className={cn(
                  "text-xs leading-tight text-muted-foreground text-pretty",
                  showStopwatch && "pl-6",
                )}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {headerAction ? (
            <div className="shrink-0">{headerAction}</div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="py-3">{children}</CardContent>
    </Card>
  );
}

type DraftClockSecondsProps = {
  seconds: number;
  /** Emphasize when at or below this value. */
  urgentAt?: number;
  className?: string;
};

export function DraftClockSeconds({
  seconds,
  urgentAt = 20,
  className,
}: DraftClockSecondsProps) {
  return (
    <p
      className={cn(
        "text-2xl font-semibold tabular-nums",
        seconds <= urgentAt && "text-orange-500",
        seconds === 0 && "text-destructive",
        className,
      )}
    >
      {formatPickClock(seconds)}
    </p>
  );
}
