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
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <ScoringRuleText segments={rule.segments} />
      </div>
      <div className="flex shrink-0 items-center gap-2 self-center">
        <span
          className={cn(
            "text-xs font-medium uppercase tracking-wide",
            applyLabel === "None"
              ? "text-muted-foreground"
              : "text-foreground",
          )}
        >
          {applyLabel}
        </span>
        <Separator
          orientation="vertical"
          className="ml-2 h-4 self-center data-vertical:h-4 data-vertical:self-center"
        />
        <Button
          type="button"
          variant="ghost"
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
  );
}
