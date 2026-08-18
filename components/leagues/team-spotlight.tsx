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
  emptyTitle = "No data yet",
  empty,
  formatValue,
  valueClassName,
  valueHint,
}: {
  row: TeamSpotlightRow | null;
  leagueSlug?: string;
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

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <div className="flex flex-col items-center gap-2">
        <Avatar size="hero">
          {row.logoUrl ? <AvatarImage src={row.logoUrl} alt="" /> : null}
          <AvatarFallback>{teamInitials(row.teamName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 max-w-full text-center">
          <p className="truncate text-sm font-semibold text-balance">
            {row.teamName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.ownerName}</p>
        </div>
      </div>
      <div className="flex flex-col items-center">
        <p
          className={cn(
            "text-2xl font-semibold leading-none tracking-tight tabular-nums",
            valueClassName,
          )}
        >
          {formatValue(row.value)}
        </p>
        {valueHint ? (
          <p className="mt-1 text-xs leading-none text-muted-foreground">
            {valueHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
