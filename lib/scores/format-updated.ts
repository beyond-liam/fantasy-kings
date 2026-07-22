/** Relative “Scores updated …” label for matchup freshness UI. */
export function formatScoresUpdatedLabel(updatedAt: Date): string {
  const now = Date.now();
  const then = updatedAt.getTime();
  const deltaSec = Math.max(0, Math.round((now - then) / 1000));

  if (deltaSec < 45) {
    return "Scores updated just now";
  }
  if (deltaSec < 3600) {
    const mins = Math.max(1, Math.round(deltaSec / 60));
    return `Scores updated ${mins}m ago`;
  }
  if (deltaSec < 86400) {
    const hours = Math.max(1, Math.round(deltaSec / 3600));
    return `Scores updated ${hours}h ago`;
  }

  return `Scores updated ${updatedAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
}
