import { Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { ScoringRuleText } from "@/components/leagues/scoring/scoring-rule-text";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatScoringPositions, type ScoringRule } from "@/lib/leagues/scoring";
import { cn } from "@/lib/utils";

type ScoringRuleRowProps = {
  rule: ScoringRule;
  onEdit: (rule: ScoringRule) => void;
  onDelete: (ruleId: string) => void;
};

export function ScoringRuleRow({
  rule,
  onEdit,
  onDelete,
}: ScoringRuleRowProps) {
  const applyLabel = formatScoringPositions(rule.positions);

  return (
    <div className="flex flex-col gap-3 px-4 py-3 @min-[28rem]:flex-row @min-[28rem]:items-center @min-[28rem]:justify-between @min-[28rem]:gap-4">
      <div className="min-w-0 flex-1">
        <ScoringRuleText segments={rule.segments} />
      </div>
      <div className="flex items-center justify-between gap-3 @min-[28rem]:justify-end @min-[28rem]:gap-2">
        <span
          className={cn(
            "min-w-0 text-xs font-medium tracking-wide text-pretty uppercase",
            applyLabel === "None"
              ? "text-muted-foreground"
              : "text-foreground",
          )}
        >
          {applyLabel}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Separator
            orientation="vertical"
            className="hidden h-4 self-center data-vertical:h-4 data-vertical:self-center @min-[28rem]:ml-2 @min-[28rem]:block"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label={`Edit ${rule.stat}`}
            onClick={() => onEdit(rule)}
          >
            <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
          </Button>
          <Button
            type="button"
            variant="ghost-destructive"
            size="icon-sm"
            aria-label={`Delete ${rule.stat}`}
            onClick={() => onDelete(rule.id)}
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
          </Button>
        </div>
      </div>
    </div>
  );
}
