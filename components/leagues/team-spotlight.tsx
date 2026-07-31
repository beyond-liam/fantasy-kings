import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { teamInitials } from "@/lib/leagues/standings";
import { cn } from "@/lib/utils";

export type TeamSpotlightRow = {
  teamId: string;
  teamPublicId: string | null;
  teamName: string;
  ownerName: string;
  logoUrl: string | null;
  value: number;
};

export function TeamSpotlight({
  row,
  leagueSlug,
  emptyTitle = "No data yet",
  empty,
  formatValue,
  valueClassName,
  valueHint,
}: {
  row: TeamSpotlightRow | null;
  leagueSlug: string;
  emptyTitle?: string;
  empty: string;
  formatValue: (value: number) => string;
  valueClassName?: string;
  valueHint?: string;
}) {
  if (!row) {
    return (
      <Empty size="sm">
        <EmptyHeader>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{empty}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const href = row.teamPublicId
    ? `/league/${leagueSlug}/team/${row.teamPublicId}`
    : `/league/${leagueSlug}`;

  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 py-2 text-center outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Avatar size="lg" className="size-16 text-base">
        {row.logoUrl ? <AvatarImage src={row.logoUrl} alt="" /> : null}
        <AvatarFallback className="text-sm">
          {teamInitials(row.teamName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 max-w-full">
        <p className="truncate text-sm font-medium text-balance">
          {row.teamName}
        </p>
        <p className="truncate text-xs text-muted-foreground">{row.ownerName}</p>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            valueClassName,
          )}
        >
          {formatValue(row.value)}
        </p>
        {valueHint ? (
          <p className="text-xs text-muted-foreground">{valueHint}</p>
        ) : null}
      </div>
    </Link>
  );
}
