"use client";

import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TABLE_ENTITY_LINK_CLASSNAME } from "@/components/ui/table";
import { teamInitials } from "@/lib/leagues/standings";
import { cn } from "@/lib/utils";

type TeamIdentityProps = {
  teamName: string;
  ownerName: string;
  claimed?: boolean;
  href?: string | null;
  logoUrl?: string | null;
  className?: string;
};

export function TeamIdentity({
  teamName,
  ownerName,
  claimed = true,
  href,
  logoUrl,
  className,
}: TeamIdentityProps) {
  if (!claimed) {
    return (
      <div
        className={cn(
          "flex min-w-0 items-center gap-2.5 text-muted-foreground",
          className,
        )}
      >
        <div className="size-6 shrink-0 rounded-full bg-muted" aria-hidden />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm">{teamName}</span>
          <span className="truncate text-xs">{ownerName}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar size="sm">
        {logoUrl ? <AvatarImage src={logoUrl} alt="" /> : null}
        <AvatarFallback>{teamInitials(teamName)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        {href ? (
          <Link href={href} className={TABLE_ENTITY_LINK_CLASSNAME}>
            {teamName}
          </Link>
        ) : (
          <span className="truncate font-medium">{teamName}</span>
        )}
        <span className="truncate text-xs text-muted-foreground">
          {ownerName}
        </span>
      </div>
    </div>
  );
}
