"use client";

import {
  Calendar03Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type MatchupLockStatus = "scheduled" | "in_progress" | "final";

type MatchupStatusBadgeProps = {
  status: MatchupLockStatus;
  className?: string;
};

function resolveBadge(status: MatchupLockStatus) {
  switch (status) {
    case "final":
      return {
        variant: "success" as const,
        icon: CheckmarkCircle01Icon,
        label: "Final",
      };
    case "in_progress":
      return {
        variant: "warning" as const,
        icon: Loading03Icon,
        label: "Live",
        iconClassName: "animate-spin",
      };
    default:
      return {
        variant: "secondary" as const,
        icon: Calendar03Icon,
        label: "Scheduled",
      };
  }
}

export function MatchupStatusBadge({
  status,
  className,
}: MatchupStatusBadgeProps) {
  const { variant, icon, label, iconClassName } = resolveBadge(status);

  return (
    <Badge variant={variant} className={cn("gap-1", className)}>
      <HugeiconsIcon
        icon={icon}
        strokeWidth={2}
        className={cn("size-3 shrink-0", iconClassName)}
        data-icon="inline-start"
      />
      {label}
    </Badge>
  );
}
