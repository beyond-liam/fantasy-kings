import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  MinusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { TeamIdentity } from "@/components/leagues/standings/team-identity";
import type { PowerRankingTeamRow } from "@/lib/leagues/power-rankings/types";
import { cn } from "@/lib/utils";

type PowerRankingRowProps = {
  row: PowerRankingTeamRow;
  leagueSlug: string;
  className?: string;
};

function RankDelta({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-xs tabular-nums text-muted-foreground"
        aria-label="No change"
      >
        <HugeiconsIcon
          icon={MinusSignIcon}
          strokeWidth={2}
          className="size-3.5"
        />
      </span>
    );
  }

  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        up ? "text-success" : "text-destructive",
      )}
      aria-label={up ? `Up ${delta}` : `Down ${Math.abs(delta)}`}
    >
      <HugeiconsIcon
        icon={up ? ArrowUp01Icon : ArrowDown01Icon}
        strokeWidth={2}
        className="size-3.5"
      />
      {Math.abs(delta)}
    </span>
  );
}

function PowerMeter({
  score,
  tone,
}: {
  score: number;
  tone: PowerRankingTeamRow["tone"];
}) {
  const fill =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : "bg-destructive";

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Power score ${score}`}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width,background-color] duration-300 ease-out",
          fill,
        )}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

/** Card-style row for one team in the power rankings list. */
export function PowerRankingRow({
  row,
  leagueSlug,
  className,
}: PowerRankingRowProps) {
  const href = row.teamPublicId
    ? `/league/${leagueSlug}/team/${row.teamPublicId}`
    : null;

  return (
    <article
      className={cn(
        "grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg bg-muted/30 px-3 py-3 ring-1 ring-foreground/8 sm:grid-cols-[4rem_minmax(0,14rem)_minmax(0,1fr)_3rem] sm:gap-x-4 sm:px-4",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-lg font-semibold tabular-nums tracking-tight">
          {row.rank}
        </span>
        <RankDelta delta={row.rankDelta} />
      </div>

      <TeamIdentity
        teamName={row.teamName}
        ownerName={row.ownerName}
        ownerUserId={row.ownerUserId}
        logoUrl={row.logoUrl}
        href={href}
      />

      <span className="justify-self-end text-md font-semibold tabular-nums tracking-tight sm:col-start-4 sm:row-start-1">
        {row.powerScore}
      </span>

      <div className="col-span-3 min-w-0 sm:col-span-1 sm:col-start-3 sm:row-start-1">
        <PowerMeter score={row.powerScore} tone={row.tone} />
      </div>
    </article>
  );
}
