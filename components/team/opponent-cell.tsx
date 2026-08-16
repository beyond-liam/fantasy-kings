import { cn } from "@/lib/utils";
import type { PlayerOpponent } from "@/lib/nfl/matchups";

const PLACEHOLDER = "—";

type OpponentCellProps = {
  opponent?: PlayerOpponent | string | null;
  className?: string;
};

function normalizeOpponent(
  opponent: OpponentCellProps["opponent"],
): PlayerOpponent | null {
  if (!opponent) {
    return null;
  }
  if (typeof opponent === "string") {
    return {
      label: opponent,
      kickoffLabel: null,
      gameStatus: null,
      hasPossession: false,
      inRedZone: false,
    };
  }
  return opponent;
}

export function OpponentCell({ opponent, className }: OpponentCellProps) {
  const value = normalizeOpponent(opponent);

  if (!value) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        {PLACEHOLDER}
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="leading-tight text-foreground tabular-nums">
        {value.label}
      </span>
      {value.kickoffLabel ? (
        <span
          className={cn(
            "whitespace-nowrap text-[11px] leading-tight tabular-nums",
            value.gameStatus === "in"
              ? "text-success"
              : "text-muted-foreground",
          )}
        >
          {value.kickoffLabel}
        </span>
      ) : null}
    </div>
  );
}
