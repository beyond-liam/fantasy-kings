"use client";

import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useState } from "react";

import { ScoringRuleText } from "@/components/leagues/scoring/scoring-rule-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  buildScoringRule,
  SCORING_CATEGORY_LABELS,
  SCORING_POSITIONS,
  type ScoringPosition,
  type ScoringRuleDefinition,
} from "@/lib/leagues/scoring";
import {
  formatTemplateLabel,
  getCatalogComboKey,
  getStatDefinition,
  getStatsForCategory,
  getTemplateForKind,
  getTemplatesForStat,
  getUsedCatalogCombos,
  normalizeRuleToCatalogCombo,
  normalizeRuleToCatalogStat,
  type ScoringRuleField,
  type ScoringRuleTemplate,
} from "@/lib/leagues/scoring/stats";

type ScoringRuleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: ScoringRuleDefinition | null;
  mode: "edit" | "create";
  existingRules: ScoringRuleDefinition[];
  onSave: (rule: ScoringRuleDefinition) => void;
};

const FIELD_LABELS: Record<ScoringRuleField, string> = {
  points: "Points (P)",
  every: "Every (X)",
  threshold: "Threshold (L)",
  maxThreshold: "Maximum (H)",
  minYards: "Yard (L)",
  maxYards: "Yard (H)",
};

function getFieldValue(
  draft: ScoringRuleDefinition,
  field: ScoringRuleField,
): number {
  switch (field) {
    case "points":
      return draft.points;
    case "every":
      return draft.every ?? 1;
    case "threshold":
      return draft.threshold ?? 0;
    case "maxThreshold":
      return draft.maxThreshold ?? 0;
    case "minYards":
      return draft.minYards ?? 0;
    case "maxYards":
      return draft.maxYards ?? 0;
  }
}

function setFieldValue(
  draft: ScoringRuleDefinition,
  field: ScoringRuleField,
  value: number,
): ScoringRuleDefinition {
  switch (field) {
    case "points":
      return { ...draft, points: value };
    case "every":
      return { ...draft, every: value };
    case "threshold":
      return { ...draft, threshold: value };
    case "maxThreshold":
      return { ...draft, maxThreshold: value };
    case "minYards":
      return { ...draft, minYards: value };
    case "maxYards":
      return { ...draft, maxYards: value };
  }
}

function applyTemplate(
  draft: ScoringRuleDefinition,
  template: ScoringRuleTemplate,
): ScoringRuleDefinition {
  return {
    ...draft,
    kind: template.kind,
    every: template.fields.includes("every") ? draft.every ?? 1 : undefined,
    threshold: template.fields.includes("threshold")
      ? draft.threshold ?? 0
      : undefined,
    maxThreshold: template.fields.includes("maxThreshold")
      ? draft.maxThreshold ?? 0
      : undefined,
    minYards: template.fields.includes("minYards")
      ? draft.minYards ?? 0
      : undefined,
    maxYards: template.fields.includes("maxYards")
      ? draft.maxYards ?? 0
      : undefined,
  };
}

export function ScoringRuleDialog({
  open,
  onOpenChange,
  rule,
  mode,
  existingRules,
  onSave,
}: ScoringRuleDialogProps) {
  const [draft, setDraft] = useState<ScoringRuleDefinition | null>(rule);

  useEffect(() => {
    if (open && rule) {
      setDraft({
        ...rule,
        positions: [...rule.positions],
        // Align picker value with catalog options (handles legacy preset labels).
        stat: normalizeRuleToCatalogStat(rule),
      });
    }
  }, [open, rule]);

  const categoryLabel = draft
    ? SCORING_CATEGORY_LABELS[draft.category]
    : "";
  const catalogStats = draft ? getStatsForCategory(draft.category) : [];
  const hasCategoryCatalog = catalogStats.length > 0;
  const usedCombos = useMemo(() => {
    if (!draft) {
      return new Set<string>();
    }

    return getUsedCatalogCombos(existingRules, {
      category: draft.category,
      excludeRuleId: mode === "edit" ? draft.id : undefined,
    });
  }, [draft, existingRules, mode]);
  const selectedStat = draft ? normalizeRuleToCatalogStat(draft) : "";
  const selectedCombo = draft
    ? normalizeRuleToCatalogCombo({ ...draft, stat: selectedStat })
    : null;
  const selectedComboKey = selectedCombo
    ? getCatalogComboKey(selectedCombo)
    : "";
  const selectedComboInUse = Boolean(
    selectedComboKey && usedCombos.has(selectedComboKey),
  );
  const statDefinition = draft
    ? getStatDefinition(draft.category, selectedStat)
    : undefined;
  const usesCatalog = Boolean(statDefinition);
  const templates = useMemo(() => {
    if (!statDefinition) {
      return [];
    }
    return getTemplatesForStat(statDefinition);
  }, [statDefinition]);
  const activeTemplate = useMemo(() => {
    if (!draft || templates.length === 0) {
      return null;
    }
    return getTemplateForKind(
      templates,
      normalizeRuleToCatalogCombo(draft).kind,
    );
  }, [draft, templates]);
  const isLegacyRule = usesCatalog && templates.length > 0 && !activeTemplate;
  const previewRule = draft ? buildScoringRule(draft) : null;

  if (!draft) {
    return null;
  }

  const handleSave = () => {
    if (mode === "create" && selectedComboInUse) {
      return;
    }
    onSave({
      ...draft,
      stat: selectedStat,
    });
    onOpenChange(false);
  };

  const pickFirstAvailableTemplate = (
    current: ScoringRuleDefinition,
    nextStat: string,
  ): ScoringRuleDefinition => {
    const definition = getStatDefinition(current.category, nextStat);
    if (!definition) {
      return current;
    }

    const nextTemplates = getTemplatesForStat(definition);
    const available =
      nextTemplates.find(
        (template) =>
          !usedCombos.has(
            getCatalogComboKey({
              stat: definition.label,
              kind: template.kind,
            }),
          ),
      ) ?? nextTemplates[0];

    return available
      ? applyTemplate({ ...current, stat: definition.label }, available)
      : { ...current, stat: definition.label };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>
            {mode === "create"
              ? `New ${categoryLabel} Rule`
              : "Customize Scoring Rule"}
          </DialogTitle>
          <DialogDescription>
            Configure how points are awarded for this rule.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-6">
          <FieldGroup>
            {hasCategoryCatalog ? (
              <FieldSet>
                <Field>
                  <FieldLabel htmlFor="scoring-rule-stat">Stat</FieldLabel>
                  <Select
                    items={catalogStats.map((stat) => ({
                      value: stat.label,
                      label: stat.label,
                    }))}
                    value={selectedStat}
                    onValueChange={(value) => {
                      if (!value) {
                        return;
                      }

                      setDraft((current) =>
                        current
                          ? pickFirstAvailableTemplate(current, value)
                          : current,
                      );
                    }}
                  >
                    <SelectTrigger id="scoring-rule-stat" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {catalogStats.map((stat) => (
                          <SelectItem key={stat.id} value={stat.label}>
                            {stat.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldSet>
            ) : null}

            {usesCatalog && templates.length > 0 ? (
              <FieldSet>
                <FieldLegend variant="label">Rule type</FieldLegend>
                {isLegacyRule ? (
                  <FieldDescription>
                    This preset rule uses a legacy format. Select a rule type to
                    continue editing.
                  </FieldDescription>
                ) : null}
                <Field>
                  <Select
                    items={templates.map((template) => ({
                      value: template.id,
                      label: formatTemplateLabel(template, selectedStat),
                    }))}
                    value={activeTemplate?.id ?? ""}
                    onValueChange={(templateId) => {
                      const template = templates.find(
                        (entry) => entry.id === templateId,
                      );
                      if (
                        !template ||
                        usedCombos.has(
                          getCatalogComboKey({
                            stat: selectedStat,
                            kind: template.kind,
                          }),
                        )
                      ) {
                        return;
                      }

                      setDraft((current) =>
                        current ? applyTemplate(current, template) : current,
                      );
                    }}
                  >
                    <SelectTrigger id="scoring-rule-type" className="w-full">
                      <SelectValue placeholder="Select a rule type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {templates.map((template) => {
                          const inUse = usedCombos.has(
                            getCatalogComboKey({
                              stat: selectedStat,
                              kind: template.kind,
                            }),
                          );
                          return (
                            <SelectItem
                              key={template.id}
                              value={template.id}
                              disabled={inUse}
                            >
                              {formatTemplateLabel(template, selectedStat)}
                              {inUse ? " (already added)" : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldSet>
            ) : null}

            {activeTemplate ? (
              <FieldSet>
                <FieldLegend variant="label">Values</FieldLegend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {activeTemplate.fields.map((field) => (
                    <Field key={field}>
                      <FieldLabel htmlFor={`scoring-rule-${field}`}>
                        {FIELD_LABELS[field]}
                      </FieldLabel>
                      <NumberInput
                        id={`scoring-rule-${field}`}
                        allowDecimal={field === "points"}
                        allowNegative={field === "points"}
                        value={getFieldValue(draft, field)}
                        onValueChange={(next) =>
                          setDraft((current) =>
                            current
                              ? setFieldValue(current, field, next)
                              : current,
                          )
                        }
                      />
                    </Field>
                  ))}
                </div>
              </FieldSet>
            ) : null}

            {previewRule ? (
              <FieldSet>
                <FieldLegend variant="label">Preview</FieldLegend>
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  <ScoringRuleText segments={previewRule.segments} />
                </div>
              </FieldSet>
            ) : null}

            <FieldSet>
              <FieldLegend variant="label">Apply this rule to</FieldLegend>
              <FieldDescription>
                Select which positions earn points from this rule.
              </FieldDescription>
              <ToggleGroup
                value={draft.positions}
                onValueChange={(positions) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          positions: positions as ScoringPosition[],
                        }
                      : current,
                  )
                }
                variant="outline"
                spacing={2}
                multiple
                className="flex flex-wrap"
              >
                {SCORING_POSITIONS.map((position) => (
                  <ToggleGroupItem
                    key={position}
                    value={position}
                    aria-label={position}
                    className="min-w-12"
                  >
                    {position}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
          </FieldGroup>
        </div>

        <DialogFooter className="border-t px-6 pt-4 pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={mode === "create" && selectedComboInUse}
          >
            <HugeiconsIcon
              icon={TickDouble02Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            {mode === "create" ? "Add Rule" : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
