"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PageFormActions } from "@/components/layout/page-form-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SortableList } from "@/components/ui/sortable-list";
import {
  randomizeDraftOrder,
  updateDraftOrder,
} from "@/lib/actions/league-settings";
import { cn } from "@/lib/utils";

export type DraftOrderTeam = {
  id: string;
  name: string;
  draftSlot: number | null;
};

type DraftOrderSettingsProps = {
  slug: string;
  leagueName: string;
  initialTeams: DraftOrderTeam[];
};

type ShuffleMode = "manual" | "random";

function orderedTeamIds(teams: DraftOrderTeam[]) {
  return [...teams]
    .sort((a, b) => {
      const aSlot = a.draftSlot ?? Number.POSITIVE_INFINITY;
      const bSlot = b.draftSlot ?? Number.POSITIVE_INFINITY;
      if (aSlot !== bSlot) return aSlot - bSlot;
      return a.name.localeCompare(b.name);
    })
    .map((team) => team.id);
}

export function DraftOrderSettings({
  slug,
  leagueName,
  initialTeams,
}: DraftOrderSettingsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<ShuffleMode>("manual");
  const [teamIds, setTeamIds] = useState(() => orderedTeamIds(initialTeams));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const teamById = useMemo(
    () => new Map(initialTeams.map((team) => [team.id, team])),
    [initialTeams],
  );

  const baselineIds = useMemo(
    () => orderedTeamIds(initialTeams),
    [initialTeams],
  );
  const hasChanges =
    mode === "random" ||
    teamIds.length !== baselineIds.length ||
    teamIds.some((id, index) => id !== baselineIds[index]);

  const sortableItems = teamIds
    .map((id) => {
      const team = teamById.get(id);
      if (!team) return null;
      return { id: team.id, label: team.name };
    })
    .filter((row): row is { id: string; label: string } => Boolean(row));

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "random"
          ? await randomizeDraftOrder(slug)
          : await updateDraftOrder(slug, teamIds);

      if (!result.success) {
        setError(result.error ?? "Could not save draft order.");
        return;
      }

      if (mode === "random" && result.teamIds) {
        setTeamIds(result.teamIds);
        setMode("manual");
      }

      router.refresh();
    });
  };

  const handleReset = () => {
    setMode("manual");
    setTeamIds(orderedTeamIds(initialTeams));
    setError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Draft Order
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {leagueName} · Slot 1 picks first in round 1.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {initialTeams.length === 0 ? (
        <Alert>
          <AlertDescription>
            No teams yet. Invite managers before setting draft order.
          </AlertDescription>
        </Alert>
      ) : (
        <FieldGroup>
          <Field>
            <FieldLabel>Shuffle</FieldLabel>
            <RadioGroup
              value={mode}
              onValueChange={(value) => {
                if (value === "manual" || value === "random") {
                  setMode(value);
                }
              }}
              className="grid gap-3"
            >
              <Label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-data-checked:border-primary",
                )}
              >
                <RadioGroupItem value="random" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">
                    Randomly generate new draft order
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Shuffles all teams when you save.
                  </span>
                </span>
              </Label>
              <Label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-data-checked:border-primary",
                )}
              >
                <RadioGroupItem value="manual" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">
                    Use the draft order below
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Drag teams to set pick order.
                  </span>
                </span>
              </Label>
            </RadioGroup>
          </Field>

          <Field>
            <FieldLabel>Order</FieldLabel>
            <FieldDescription>
              {mode === "random"
                ? "Current order preview — saving will shuffle."
                : "Drag to reorder."}
            </FieldDescription>
            <div
              className={cn(mode === "random" && "pointer-events-none opacity-60")}
            >
              <SortableList
                items={sortableItems}
                onReorder={(ids) => {
                  setMode("manual");
                  setTeamIds(ids);
                }}
              />
            </div>
          </Field>
        </FieldGroup>
      )}

      <PageFormActions>
        <Button
          type="button"
          variant="ghost"
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
          disabled={isPending || !hasChanges || initialTeams.length === 0}
          onClick={handleSave}
        >
          <HugeiconsIcon
            icon={TickDouble02Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Save
        </Button>
      </PageFormActions>
    </div>
  );
}
