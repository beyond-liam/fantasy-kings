"use client";

import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ScoringCategorySection } from "@/components/leagues/scoring/scoring-category-section";
import { ScoringPresetPicker } from "@/components/leagues/scoring/scoring-preset-picker";
import { ScoringRuleDialog } from "@/components/leagues/scoring/scoring-rule-dialog";
import { SettingsFormCard } from "@/components/leagues/settings/settings-form-card";
import { PageFormActions } from "@/components/layout/page-form-actions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  updateScoringSettings,
} from "@/lib/actions/league-settings";
import { jsonEqual } from "@/lib/json-equal";
import {
  createEmptyScoringRuleDefinition,
  getDefaultScoringRuleDefinitions,
  getScoringRulesByCategory,
  categoryHasAvailableRule,
  type ScoringCategory,
  type ScoringPreset,
  type ScoringRule,
  type ScoringRuleDefinition,
} from "@/lib/leagues/scoring";

type ScoringSettingsProps = {
  slug: string;
  leagueName: string;
  seasonStatus: string;
  initialPreset: ScoringPreset;
  initialRules: ScoringRuleDefinition[];
};

export function ScoringSettings({
  slug,
  initialPreset,
  initialRules,
}: ScoringSettingsProps) {
  const router = useRouter();
  const [preset, setPreset] = useState(initialPreset);
  const [rules, setRules] = useState(initialRules);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"edit" | "create">("edit");
  const [editingRule, setEditingRule] = useState<ScoringRuleDefinition | null>(
    null,
  );

  const categories = useMemo(
    () => getScoringRulesByCategory(rules),
    [rules],
  );
  const hasChanges =
    preset !== initialPreset || !jsonEqual(rules, initialRules);

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateScoringSettings(slug, {
        scoringPreset: preset !== initialPreset ? preset : undefined,
        scoringRules: rules,
      });
      if (!result.success) {
        setError(result.error ?? "Could not save scoring settings.");
        return;
      }

      toast.success("Scoring settings saved");
      router.refresh();
    });
  };

  const handleReset = () => {
    setPreset(initialPreset);
    setRules(initialRules);
    setError(null);
  };

  const openEditDialog = (rule: ScoringRule) => {
    setDialogMode("edit");
    setEditingRule({
      id: rule.id,
      category: rule.category,
      kind: rule.kind,
      points: rule.points,
      stat: rule.stat,
      every: rule.every,
      rate: rule.rate,
      threshold: rule.threshold,
      maxThreshold: rule.maxThreshold,
      minYards: rule.minYards,
      maxYards: rule.maxYards,
      exactValue: rule.exactValue,
      positions: [...rule.positions],
    });
    setDialogOpen(true);
  };

  const openNewDialog = (category: ScoringCategory) => {
    setDialogMode("create");
    setEditingRule(createEmptyScoringRuleDefinition(category, rules));
    setDialogOpen(true);
  };

  const handleSaveRule = (rule: ScoringRuleDefinition) => {
    setRules((current) =>
      dialogMode === "create"
        ? [...current, rule]
        : current.map((entry) => (entry.id === rule.id ? rule : entry)),
    );
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules((current) => current.filter((rule) => rule.id !== ruleId));
  };

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <SettingsFormCard
        title="Scoring Rules"
        contentClassName="flex flex-col gap-8"
        footer={
          <PageFormActions float={hasChanges}>
            <Button
              type="button"
              variant="outline"
              disabled={isPending || !hasChanges}
              onClick={handleReset}
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Reset
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending || !hasChanges}
            >
              <HugeiconsIcon
                icon={TickDouble02Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Save
            </Button>
          </PageFormActions>
        }
      >
        <FieldGroup>
        <Field>
          <FieldLabel>Scoring preset</FieldLabel>
          <ScoringPresetPicker
            value={preset}
            onValueChange={(nextPreset) => {
              setPreset(nextPreset);
              setRules(
                nextPreset === initialPreset
                  ? initialRules
                  : getDefaultScoringRuleDefinitions(nextPreset),
              );
            }}
          />
        </Field>
        </FieldGroup>

        <div className="flex flex-col gap-8">
          {categories.map(({ category, rules: categoryRules }) => (
            <ScoringCategorySection
              key={category}
              category={category}
              rules={categoryRules}
              canAddRule={categoryHasAvailableRule(category, rules)}
              onEditRule={openEditDialog}
              onDeleteRule={handleDeleteRule}
              onNewRule={openNewDialog}
            />
          ))}
        </div>
      </SettingsFormCard>

      <ScoringRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        mode={dialogMode}
        existingRules={rules}
        onSave={handleSaveRule}
      />
    </div>
  );
}
