"use client";

import { POSITION_FILTERS, type PositionFilter } from "@/lib/rankings/column-config";
import { cn } from "@/lib/utils";

export const PILL_CLASSNAME =
  "shrink-0 rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors";

export const PILL_INACTIVE_CLASSNAME = "bg-muted text-muted-foreground";

export const PILL_ACTIVE_CLASSNAME = "bg-primary text-primary-foreground";

export function PositionPills({
  value,
  onSelect,
}: {
  value: PositionFilter;
  onSelect: (position: PositionFilter) => void;
}) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="Position filter">
      {POSITION_FILTERS.map((position) => {
        const active = position === value;

        return (
          <button
            key={position}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(position)}
            className={cn(
              PILL_CLASSNAME,
              active ? PILL_ACTIVE_CLASSNAME : PILL_INACTIVE_CLASSNAME,
            )}
          >
            {position}
          </button>
        );
      })}
    </div>
  );
}
