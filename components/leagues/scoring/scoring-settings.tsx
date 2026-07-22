"use client";

import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ScoringCategorySection } from "@/components/leagues/scoring/scoring-category-section";
import { ScoringPresetPicker } from "@/components/leagues/scoring/scoring-preset-picker";
import { ScoringRuleDialog } from "@/components/leagues/scoring/scoring-rule-dialog";
import { PageFormActions } from "@/components/layout/page-form-actions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { formatLeagueLabel } from "@/lib/leagues/format";
import {
  updateScoringPreset,
  updateScoringRules,
} from "@/lib/actions/league-settings";
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
  leagueName,
  seasonStatus,
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
    preset !== initialPreset ||
    JSON.stringify(rules) !== JSON.stringify(initialRules);

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      if (preset !== initialPreset) {
        const presetResult = await updateScoringPreset(slug, preset);
        if (!presetResult.success) {
          setError(presetResult.error ?? "Could not update scoring preset.");
          return;
        }
      }

      const rulesResult = await updateScoringRules(slug, rules);
      if (!rulesResult.success) {
        setError(rulesResult.error ?? "Could not save scoring rules.");
        return;
      }

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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Scoring rules
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {leagueName}
          {" · "}
          <span className="capitalize">{formatLeagueLabel(seasonStatus)}</span>
        </p>
      </div>

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
          <FieldDescription>
            All three presets share the same default scoring rules. Only
            reception scoring differs between them. Changing the preset resets
            your custom rules to that preset&apos;s defaults when saved.
          </FieldDescription>
        </Field>
      </FieldGroup>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

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

      <PageFormActions>
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
