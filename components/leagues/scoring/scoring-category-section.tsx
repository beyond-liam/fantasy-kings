import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { ScoringRuleRow } from "@/components/leagues/scoring/scoring-rule-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";
import {
  SCORING_CATEGORY_LABELS,
  type ScoringCategory,
  type ScoringRule,
} from "@/lib/leagues/scoring";

type ScoringCategorySectionProps = {
  category: ScoringCategory;
  rules: ScoringRule[];
  canAddRule: boolean;
  onEditRule: (rule: ScoringRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onNewRule: (category: ScoringCategory) => void;
};

export function ScoringCategorySection({
  category,
  rules,
  canAddRule,
  onEditRule,
  onDeleteRule,
  onNewRule,
}: ScoringCategorySectionProps) {
  const categoryLabel = SCORING_CATEGORY_LABELS[category];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">{categoryLabel}</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canAddRule}
          onClick={() => onNewRule(category)}
        >
          <HugeiconsIcon
            icon={Add01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          New {categoryLabel} Rule
        </Button>
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="p-0">
          {rules.length > 0 ? (
            <ul className="flex flex-col">
              {rules.map((rule) => (
                <li key={rule.id}>
                  <ScoringRuleRow
                    rule={rule}
                    onEdit={onEditRule}
                    onDelete={onDeleteRule}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Empty className="py-6">
              <EmptyHeader>
                <EmptyDescription>
                  No {categoryLabel.toLowerCase()} rules yet.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
