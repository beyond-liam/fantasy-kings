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
import { cn } from "@/lib/utils";

type DraftClockCardProps = {
  title: string;
  /** Opposite the heading (e.g. play/pause). */
  headerAction?: ReactNode;
  showStopwatch?: boolean;
  children: ReactNode;
  className?: string;
};

export function DraftClockCard({
  title,
  headerAction,
  showStopwatch = true,
  children,
  className,
}: DraftClockCardProps) {
  return (
    <Card size="sm" className={cn("min-w-[16rem] gap-0 py-0", className)}>
      <CardHeader className="border-b bg-muted/40 py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base text-balance">
            {showStopwatch ? (
              <HugeiconsIcon
                icon={StopWatchIcon}
                strokeWidth={2}
                className="size-4 shrink-0"
              />
            ) : null}
            {title}
          </CardTitle>
          {headerAction}
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
      {seconds}s
    </p>
  );
}
