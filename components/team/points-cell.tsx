import { formatStatValue } from "@/lib/rankings/column-config";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "—";

type PointsCellProps = {
  actualPts?: number | null;
  projectedPts?: number | null;
  /** When false, actual stays as a dash even if a value exists. */
  showActual?: boolean;
  onActualClick?: () => void;
  className?: string;
};

export function PointsCell({
  actualPts,
  projectedPts,
  showActual = false,
  onActualClick,
  className,
}: PointsCellProps) {
  const showValue = showActual && actualPts != null;
  const actualDisplay = showValue
    ? formatStatValue(actualPts, 2)
    : PLACEHOLDER;
  const projectedDisplay =
    projectedPts != null ? formatStatValue(projectedPts, 2) : null;
  const clickable = Boolean(showValue && onActualClick);

  return (
    <div className={cn("flex flex-col gap-1 tabular-nums", className)}>
      {clickable ? (
        <button
          type="button"
          onClick={onActualClick}
          className="w-fit text-left font-semibold leading-tight underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {actualDisplay}
        </button>
      ) : (
        <span
          className={cn(
            "leading-tight font-semibold",
            actualDisplay === PLACEHOLDER && "text-muted-foreground",
          )}
        >
          {actualDisplay}
        </span>
      )}
      {projectedDisplay ? (
        <span className="text-[11px] leading-tight text-muted-foreground">
          {projectedDisplay}
        </span>
      ) : null}
    </div>
  );
}
