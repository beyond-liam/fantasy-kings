type ScoresFreshnessBannerProps = {
  /** ISO timestamp of latest player_scores update for this week. */
  updatedAt: string | null;
  /** True when any NFL game on the board is in progress. */
  hasLiveNflGames?: boolean;
};

function formatLastUpdated(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Live-only freshness line. Hidden when no NFL games are in progress.
 */
export function ScoresFreshnessBanner({
  updatedAt,
  hasLiveNflGames = false,
}: ScoresFreshnessBannerProps) {
  if (!hasLiveNflGames || !updatedAt) {
    return null;
  }

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return (
    <p
      className="text-xs text-muted-foreground tabular-nums"
      suppressHydrationWarning
      title={date.toISOString()}
    >
      Last updated: {formatLastUpdated(date)}
    </p>
  );
}
