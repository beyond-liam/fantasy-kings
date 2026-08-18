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

/**
 * League-scoped manager status. Render as a direct child of `Avatar` so the
 * shadcn badge positioning and size variants remain intact.
 */
export function ManagerPresenceBadge({
  userId,
}: {
  userId: string | null | undefined;
}) {
  const presence = useLeaguePresence(userId);
  if (!presence) {
    return null;
  }

  const label = formatPresenceLabel({
    status: presence.status,
    lastSeenAt: new Date(presence.lastSeenAt),
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <AvatarBadge
              aria-label={label}
              className={cn(
                presence.status === "online" && "bg-success",
                presence.status === "offline" && "bg-muted-foreground",
                presence.status === "inactive" && "bg-destructive",
              )}
            />
          }
        />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
