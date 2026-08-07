"use client";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getInjuryIndicator } from "@/lib/players/injury";
import {
  getPlayerAvatarUrl,
  getPlayerInitials,
} from "@/lib/sleeper/avatars";
import { cn } from "@/lib/utils";

type PlayerAvatarProps = {
  fullName: string;
  sleeperId?: string | null;
  primaryPositionId: string;
  nflTeam?: string | null;
  injuryStatus?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
};

export function PlayerAvatar({
  fullName,
  sleeperId,
  primaryPositionId,
  nflTeam,
  injuryStatus,
  size = "sm",
  className,
}: PlayerAvatarProps) {
  const src = getPlayerAvatarUrl({
    sleeperId,
    primaryPositionId,
    nflTeam,
  });
  const injury = getInjuryIndicator(injuryStatus);

  return (
    <Avatar size={size} className={cn("bg-muted", className)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback>{getPlayerInitials(fullName)}</AvatarFallback>
      {injury ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <AvatarBadge
                  aria-label={injury.label}
                  className={cn(
                    injury.tone === "questionable" && "bg-warning",
                    injury.tone === "out" && "bg-destructive",
                  )}
                />
              }
            />
            <TooltipContent>{injury.label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </Avatar>
  );
}
