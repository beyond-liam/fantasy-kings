import type { ScoringRuleSegment } from "@/lib/leagues/scoring/types";
import { cn } from "@/lib/utils";

type ScoringRuleTextProps = {
  segments: ScoringRuleSegment[];
};

export function ScoringRuleText({ segments }: ScoringRuleTextProps) {
  return (
    <p className="text-sm leading-relaxed">
      {segments.map((segment, index) => {
        if (segment.type === "points") {
          return (
            <span
              key={index}
              className={cn(
                "font-semibold tabular-nums",
                segment.value < 0 ? "text-destructive" : "text-success",
              )}
            >
              {segment.value}
            </span>
          );
        }

        if (segment.type === "stat") {
          return (
            <strong key={index} className="font-semibold text-foreground">
              {segment.value}
            </strong>
          );
        }

        return (
          <span
            key={index}
            className={cn(segment.muted && "text-muted-foreground")}
          >
            {segment.value}
          </span>
        );
      })}
    </p>
  );
}
