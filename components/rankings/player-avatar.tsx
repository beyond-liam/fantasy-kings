"use client";

import {
  Avatar,
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
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Avatar size={size} className="bg-muted">
        {src ? <AvatarImage src={src} alt="" /> : null}
        <AvatarFallback>{getPlayerInitials(fullName)}</AvatarFallback>
      </Avatar>
      {injury ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className={cn(
                    "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background",
                    injury.tone === "questionable" && "bg-orange-500",
                    injury.tone === "out" && "bg-rose-500",
                  )}
                  aria-label={injury.label}
                />
              }
            />
            <TooltipContent>{injury.label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </span>
  );
}
