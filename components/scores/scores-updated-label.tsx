"use client";

import { formatScoresUpdatedLabel } from "@/lib/scores/format-updated";

type ScoresUpdatedLabelProps = {
  updatedAt: string | null;
};

/** Client label so relative time stays fresh after LiveRefresh. */
export function ScoresUpdatedLabel({ updatedAt }: ScoresUpdatedLabelProps) {
  if (!updatedAt) {
    return null;
  }

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return (
    <p
      className="text-sm text-muted-foreground tabular-nums"
      suppressHydrationWarning
      title={date.toISOString()}
    >
      {formatScoresUpdatedLabel(date)}
    </p>
  );
}
