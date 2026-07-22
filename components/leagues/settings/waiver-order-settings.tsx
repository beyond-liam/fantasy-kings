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
import { SortableList } from "@/components/ui/sortable-list";
import { updateWaiverOrder } from "@/lib/actions/league-settings";

export type WaiverOrderTeam = {
  id: string;
  name: string;
  waiverPriority: number;
};

type WaiverOrderSettingsProps = {
  slug: string;
  leagueName: string;
  waiverType: "priority" | "faab";
  initialTeams: WaiverOrderTeam[];
};

function orderedTeamIds(teams: WaiverOrderTeam[]) {
  return [...teams]
    .sort((a, b) => {
      const aPriority = a.waiverPriority ?? Number.POSITIVE_INFINITY;
      const bPriority = b.waiverPriority ?? Number.POSITIVE_INFINITY;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.name.localeCompare(b.name);
    })
    .map((team) => team.id);
}

export function WaiverOrderSettings({
  slug,
  leagueName,
  waiverType,
  initialTeams,
}: WaiverOrderSettingsProps) {
  const router = useRouter();
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
      const result = await updateWaiverOrder(slug, teamIds);
      if (!result.success) {
        setError(result.error ?? "Could not save waiver order.");
        return;
      }
      router.refresh();
    });
  };

  const handleReset = () => {
    setTeamIds(orderedTeamIds(initialTeams));
    setError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Waiver Order
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {leagueName} · Position 1 has the highest priority.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {waiverType === "faab" ? (
        <Alert>
          <AlertDescription>
            This league uses FAAB. Priority order still applies when bids tie.
          </AlertDescription>
        </Alert>
      ) : null}

      {initialTeams.length === 0 ? (
        <Alert>
          <AlertDescription>
            No teams yet. Invite managers before setting waiver order.
          </AlertDescription>
        </Alert>
      ) : (
        <FieldGroup>
          <Field>
            <FieldLabel>Order</FieldLabel>
            <FieldDescription>Drag to reorder.</FieldDescription>
            <SortableList items={sortableItems} onReorder={setTeamIds} />
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
