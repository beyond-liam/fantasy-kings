"use client";

import { ClockAlertIcon, ClockPlusIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const FORCED_AUTOPICK_TOOLTIP = "Two missed picks, autopick is on";
export const ENABLED_AUTOPICK_TOOLTIP = "Autopick enabled";

type DraftAutopickIconProps = {
  className?: string;
  tooltip: string;
  icon: typeof ClockAlertIcon;
  iconClassName: string;
};

function DraftAutopickIcon({
  className,
  tooltip,
  icon,
  iconClassName,
}: DraftAutopickIconProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={cn("inline-flex shrink-0", className)}
              tabIndex={0}
              aria-label={tooltip}
            >
              <HugeiconsIcon
                icon={icon}
                strokeWidth={2}
                className={iconClassName}
              />
            </span>
          }
        />
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function DraftForcedAutopickIndicator({
  className,
}: {
  className?: string;
}) {
  return (
    <DraftAutopickIcon
      className={className}
      tooltip={FORCED_AUTOPICK_TOOLTIP}
      icon={ClockAlertIcon}
      iconClassName="size-2.5 text-destructive"
    />
  );
}

export function DraftEnabledAutopickIndicator({
  className,
}: {
  className?: string;
}) {
  return (
    <DraftAutopickIcon
      className={className}
      tooltip={ENABLED_AUTOPICK_TOOLTIP}
      icon={ClockPlusIcon}
      iconClassName="size-2.5 text-muted-foreground"
    />
  );
}

export function DraftAutopickStatusIcon({
  forcedAutoPick,
  autoPickEnabled,
  claimed = true,
}: {
  forcedAutoPick?: boolean;
  autoPickEnabled?: boolean;
  claimed?: boolean;
}) {
  if (forcedAutoPick) {
    return <DraftForcedAutopickIndicator />;
  }
  if (claimed && autoPickEnabled) {
    return <DraftEnabledAutopickIndicator />;
  }
  return null;
}

export function DraftTeamNameWithForcedAutopick({
  name,
  forcedAutoPick,
  autoPickEnabled,
  claimed = true,
  className,
  nameClassName,
}: {
  name: string;
  forcedAutoPick?: boolean;
  autoPickEnabled?: boolean;
  claimed?: boolean;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center justify-center gap-1",
        className,
      )}
    >
      <span className={cn("min-w-0 truncate", nameClassName)}>{name}</span>
      <DraftAutopickStatusIcon
        forcedAutoPick={forcedAutoPick}
        autoPickEnabled={autoPickEnabled}
        claimed={claimed}
      />
    </span>
  );
}
