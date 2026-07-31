"use client";

import { AvatarBadge } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLeaguePresence } from "@/components/leagues/presence/league-presence-provider";
import { formatPresenceLabel } from "@/lib/presence";
import { cn } from "@/lib/utils";

function ManagerPresenceIndicatorBase({
  userId,
  variant,
}: {
  userId: string | null | undefined;
  variant: "avatar" | "inline";
}) {
  const presence = useLeaguePresence(userId);
  if (!presence) {
    return null;
  }

  const label = formatPresenceLabel({
    status: presence.status,
    lastSeenAt: new Date(presence.lastSeenAt),
  });
  const className = cn(
    presence.status === "online" && "bg-success",
    presence.status === "offline" && "bg-muted-foreground",
    presence.status === "inactive" && "bg-destructive",
  );
  const indicator =
    variant === "avatar" ? (
      <AvatarBadge aria-label={label} className={className} />
    ) : (
      <span
        aria-label={label}
        className={cn("inline-flex size-2.5 shrink-0 rounded-full", className)}
      />
    );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={indicator} />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * League-scoped manager status. Render as a direct child of `Avatar` so the
 * shadcn badge positioning and size variants remain intact.
 */
export function ManagerPresenceBadge({
  userId,
}: {
  userId: string | null | undefined;
}) {
  return <ManagerPresenceIndicatorBase userId={userId} variant="avatar" />;
}

/** Inline status dot for manager-name surfaces without an avatar. */
export function ManagerPresenceIndicator({
  userId,
}: {
  userId: string | null | undefined;
}) {
  return (
    <ManagerPresenceIndicatorBase userId={userId} variant="inline" />
  );
}
