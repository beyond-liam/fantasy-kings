"use client";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { getNflTeamLabel } from "@/lib/nfl/teams";
import { getSleeperTeamLogoUrl } from "@/lib/sleeper/avatars";
import { cn } from "@/lib/utils";

type NflTeamOptionProps = {
  abbrev: string;
  className?: string;
};

/** Logo + full team name for select items and triggers. */
export function NflTeamOption({ abbrev, className }: NflTeamOptionProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Avatar className="size-5 shrink-0">
        <AvatarImage src={getSleeperTeamLogoUrl(abbrev)} alt="" />
      </Avatar>
      <span className="truncate">{getNflTeamLabel(abbrev)}</span>
    </span>
  );
}
