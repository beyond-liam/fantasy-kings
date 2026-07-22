import { formatStatValue } from "@/lib/rankings/column-config";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "—";

type PointsCellProps = {
  actualPts?: number | null;
  projectedPts?: number | null;
  /** When false, actual stays as a dash even if a value exists. */
  showActual?: boolean;
  className?: string;
};

export function PointsCell({
  actualPts,
  projectedPts,
  showActual = false,
  className,
}: PointsCellProps) {
  const actualDisplay =
    showActual && actualPts != null
      ? formatStatValue(actualPts, 2)
      : PLACEHOLDER;
  const projectedDisplay =
    projectedPts != null ? formatStatValue(projectedPts, 2) : null;

  return (
    <div className={cn("flex flex-col gap-0.5 tabular-nums", className)}>
      <span
        className={cn(
          "leading-tight",
          actualDisplay === PLACEHOLDER && "text-muted-foreground",
        )}
      >
        {actualDisplay}
      </span>
      {projectedDisplay ? (
        <span className="text-xs leading-tight text-muted-foreground">
          {projectedDisplay}
        </span>
      ) : null}
    </div>
  );
}
