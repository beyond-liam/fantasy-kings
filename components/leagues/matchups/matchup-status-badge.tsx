"use client";

import {
  Calendar03Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { LivePulseDot } from "@/components/live-pulse-dot";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type MatchupLockStatus = "scheduled" | "in_progress" | "final";

type MatchupStatusBadgeProps = {
  status: MatchupLockStatus;
  className?: string;
};

type BadgeConfig =
  | {
      variant: "success";
      label: "Final";
      icon: typeof CheckmarkCircle01Icon;
      pulse?: false;
    }
  | {
      variant: "success";
      label: "Live";
      pulse: true;
    }
  | {
      variant: "outline";
      label: "Scheduled";
      icon: typeof Calendar03Icon;
      pulse?: false;
    };

function resolveBadge(status: MatchupLockStatus): BadgeConfig {
  switch (status) {
    case "final":
      return {
        variant: "success",
        icon: CheckmarkCircle01Icon,
        label: "Final",
      };
    case "in_progress":
      return {
        variant: "success",
        label: "Live",
        pulse: true,
      };
    default:
      return {
        variant: "outline",
        icon: Calendar03Icon,
        label: "Scheduled",
      };
  }
}

export function MatchupStatusBadge({
  status,
  className,
}: MatchupStatusBadgeProps) {
  const config = resolveBadge(status);

  return (
    <Badge
      variant={config.variant}
      className={cn(config.pulse && "overflow-visible", className)}
    >
      {config.pulse ? (
        <LivePulseDot />
      ) : (
        <HugeiconsIcon
          icon={config.icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
      )}
      {config.label}
    </Badge>
  );
}
