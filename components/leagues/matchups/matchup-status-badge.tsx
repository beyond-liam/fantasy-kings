"use client";

import {
  CheckmarkCircle01Icon,
  Loading03Icon,
  Time04Icon,
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
      };
    default:
      return {
        variant: "secondary" as const,
        icon: Time04Icon,
        label: "Scheduled",
      };
  }
}

export function MatchupStatusBadge({
  status,
  className,
}: MatchupStatusBadgeProps) {
  const { variant, icon, label } = resolveBadge(status);

  return (
    <Badge variant={variant} className={cn(className)}>
      <HugeiconsIcon icon={icon} strokeWidth={2} data-icon="inline-start" />
      {label}
    </Badge>
  );
}
