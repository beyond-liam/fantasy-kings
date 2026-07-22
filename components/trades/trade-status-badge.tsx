"use client";

import {
  Alert02Icon,
  CheckmarkCircle01Icon,
  CircleXIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatTradeStatusLabel } from "@/lib/leagues/trades/status";

type TradeStatusBadgeProps = {
  status: string;
  vetoCount?: number;
  vetoThreshold?: number;
  myTeamVetoed?: boolean;
};

function resolveTradeStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return {
        variant: "success" as const,
        icon: CheckmarkCircle01Icon,
        label: "Trade complete",
      };
    case "pending":
      return {
        variant: "warning" as const,
        icon: Alert02Icon,
        label: "Trade pending",
      };
    case "review":
    case "awaiting_commissioner":
      return {
        variant: "warning" as const,
        icon: Alert02Icon,
        label: formatTradeStatusLabel(status),
      };
    case "cancelled":
      return {
        variant: "destructive" as const,
        icon: CircleXIcon,
        label: "Trade cancelled",
      };
    default:
      return {
        variant: "destructive" as const,
        icon: CircleXIcon,
        label: formatTradeStatusLabel(status),
      };
  }
}

function formatVetoTooltip(
  count: number,
  threshold: number,
  myTeamVetoed: boolean,
) {
  const progress = `${count} of ${threshold} veto${threshold === 1 ? "" : "es"} needed to cancel this trade.`;
  if (myTeamVetoed) {
    return `Your team voted to veto. ${progress}`;
  }
  return progress;
}

export function TradeStatusBadge({
  status,
  vetoCount,
  vetoThreshold,
  myTeamVetoed = false,
}: TradeStatusBadgeProps) {
  const { variant, icon, label } = resolveTradeStatusBadge(status);
  const showVetoes =
    status === "review" && vetoCount != null && vetoThreshold != null;
  const vetoLabel = showVetoes
    ? ` · ${vetoCount}/${vetoThreshold}${myTeamVetoed ? " · You voted" : ""}`
    : "";

  const badge = (
    <Badge variant={variant}>
      <HugeiconsIcon icon={icon} strokeWidth={2} data-icon="inline-start" />
      {label}
      {vetoLabel}
    </Badge>
  );

  if (!showVetoes) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={<span className="inline-flex cursor-default" />}
        >
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          {formatVetoTooltip(vetoCount, vetoThreshold, myTeamVetoed)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
