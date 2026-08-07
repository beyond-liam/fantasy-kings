import type { TeamStatRow } from "@/lib/espn/game-summary";
import { MISSING_VALUE } from "@/lib/espn/game-summary";
import { getNflTeamColors } from "@/lib/nfl/team-colors";

type TeamStatsComparisonProps = {
  rows: TeamStatRow[];
  awayAbbrev: string;
  homeAbbrev: string;
};

/** Parse ESPN display values into a magnitude for bar width. */
export function parseStatMagnitude(value: string): number {
  const trimmed = value.trim();
  if (!trimmed || trimmed === MISSING_VALUE || trimmed === "--") {
    return 0;
  }

  const possession = trimmed.match(/^(\d+):(\d{2})$/);
  if (possession) {
    return Number(possession[1]) * 60 + Number(possession[2]);
  }

  const fraction = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (fraction) {
    return Number(fraction[1]);
  }

  const dashed = trimmed.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (dashed) {
    return Number(dashed[1]);
  }

  const numeric = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(numeric) ? Math.abs(numeric) : 0;
}

function sharePercents(away: number, home: number): {
  awayShare: number;
  homeShare: number;
} {
  const total = away + home;
  if (total <= 0) {
    return { awayShare: 50, homeShare: 50 };
  }
  return {
    awayShare: (away / total) * 100,
    homeShare: (home / total) * 100,
  };
}

export function TeamStatsComparison({
  rows,
  awayAbbrev,
  homeAbbrev,
}: TeamStatsComparisonProps) {
  const awayColor =
    getNflTeamColors(awayAbbrev)?.primary ?? "var(--muted-foreground)";
  const homeColor =
    getNflTeamColors(homeAbbrev)?.primary ?? "var(--muted-foreground)";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 text-sm font-semibold tracking-wide text-foreground">
        <span>{awayAbbrev}</span>
        <span>{homeAbbrev}</span>
      </div>

      <ul className="flex flex-col gap-4">
        {rows.map((row) => {
          const awayMagnitude = parseStatMagnitude(row.away);
          const homeMagnitude = parseStatMagnitude(row.home);
          const { awayShare, homeShare } = sharePercents(
            awayMagnitude,
            homeMagnitude,
          );

          return (
            <li key={row.label} className="flex flex-col gap-1.5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-3">
                <p className="min-w-0 text-sm font-medium tabular-nums text-foreground">
                  {row.away}
                </p>
                <p className="max-w-28 text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase sm:max-w-32">
                  {row.label}
                </p>
                <p className="min-w-0 text-right text-sm font-medium tabular-nums text-foreground">
                  {row.home}
                </p>
              </div>
              <div
                className="flex h-1.5 w-full gap-0.5"
                aria-hidden
              >
                <div
                  className="h-full min-w-0 rounded-full transition-[width]"
                  style={{
                    width: `${awayShare}%`,
                    backgroundColor: awayColor,
                  }}
                />
                <div
                  className="h-full min-w-0 rounded-full transition-[width]"
                  style={{
                    width: `${homeShare}%`,
                    backgroundColor: homeColor,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
