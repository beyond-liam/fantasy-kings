"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  Cancel01Icon,
  DragDropVerticalIcon,
  TickDouble02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import { settingsHref } from "@/lib/leagues/settings-tabs";

import { SettingsFormCard } from "@/components/leagues/settings/settings-form-card";
import { PageFormActions } from "@/components/layout/page-form-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { realignDivisions } from "@/lib/actions/league-settings";
import { areDivisionsBalanced } from "@/lib/leagues/membership";
import { cn } from "@/lib/utils";

export type RealignDivision = {
  id: string;
  name: string;
};

export type RealignTeam = {
  id: string;
  name: string;
  divisionId: string | null;
};

type RealignDivisionsSettingsProps = {
  slug: string;
  divisions: RealignDivision[];
  teams: RealignTeam[];
};

const TEAM_TYPE = "team";

function SortableTeamCard({
  team,
  index,
  divisionId,
}: {
  team: RealignTeam;
  index: number;
  divisionId: string;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: team.id,
    index,
    group: divisionId,
    type: TEAM_TYPE,
    accept: TEAM_TYPE,
  });

  return (
    <li
      ref={ref}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-2 py-2 shadow-xs",
        isDragging && "bg-background shadow-md",
      )}
    >
      <Button
        ref={handleRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label={`Drag ${team.name}`}
      >
        <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} />
      </Button>
      <span className="min-w-0 flex-1 truncate text-sm">{team.name}</span>
    </li>
  );
}

function DivisionColumn({
  division,
  teamIds,
  teamById,
  targetCount,
}: {
  division: RealignDivision;
  teamIds: string[];
  teamById: Map<string, RealignTeam>;
  targetCount: number;
}) {
  // Low priority so item-to-item collisions win over the column droppable.
  const { ref, isDropTarget } = useDroppable({
    id: division.id,
    type: "column",
    accept: TEAM_TYPE,
    collisionPriority: 1,
  });
  const balancedHere = teamIds.length === targetCount;

  return (
    <Card
      size="sm"
      className={cn("gap-0 py-0", isDropTarget && "ring-2 ring-primary/40")}
    >
      <CardHeader className="border-b py-(--card-spacing)">
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{division.name}</span>
          <span
            className={cn(
              "tabular-nums text-xs font-normal",
              balancedHere ? "text-muted-foreground" : "text-destructive",
            )}
          >
            {teamIds.length}/{targetCount}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <ol ref={ref} className="flex min-h-24 flex-col gap-2">
          {teamIds.map((id, index) => {
            const team = teamById.get(id);
            if (!team) return null;
            return (
              <SortableTeamCard
                key={id}
                team={team}
                index={index}
                divisionId={division.id}
              />
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function buildColumns(
  divisions: RealignDivision[],
  teams: RealignTeam[],
): Record<string, string[]> {
  const columns: Record<string, string[]> = Object.fromEntries(
    divisions.map((division) => [division.id, [] as string[]]),
  );
  const fallback = divisions[0]?.id;
  for (const team of teams) {
    const divisionId =
      team.divisionId && columns[team.divisionId] != null
        ? team.divisionId
        : fallback;
    if (divisionId) {
      columns[divisionId]!.push(team.id);
    }
  }
  return columns;
}

function toAssignments(columns: Record<string, string[]>) {
  const assignments: Record<string, string> = {};
  for (const [divisionId, teamIds] of Object.entries(columns)) {
    for (const teamId of teamIds) {
      assignments[teamId] = divisionId;
    }
  }
  return assignments;
}

export function RealignDivisionsSettings({
  slug,
  divisions,
  teams,
}: RealignDivisionsSettingsProps) {
  const router = useRouter();
  const [columns, setColumns] = useState(() => buildColumns(divisions, teams));
  const previousColumns = useRef(columns);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const teamById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams],
  );
  const divisionIds = divisions.map((division) => division.id);
  const assignments = toAssignments(columns);
  const balanced = areDivisionsBalanced(divisionIds, assignments);
  const targetCount = Math.floor(teams.length / Math.max(divisions.length, 1));
  const baseline = useMemo(
    () => toAssignments(buildColumns(divisions, teams)),
    [divisions, teams],
  );
  const hasChanges =
    Object.keys(assignments).length !== Object.keys(baseline).length ||
    Object.entries(assignments).some(
      ([teamId, divisionId]) => baseline[teamId] !== divisionId,
    );

  const handleSave = () => {
    if (!balanced) {
      setError("Divisions must be balanced before saving.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await realignDivisions(slug, assignments);
      if (!result.success) {
        const message = result.error ?? "Could not realign divisions.";
        setError(message);
        toast.error(message);
        return;
      }
      toast.success("Divisions realigned");
      router.push(settingsHref(slug, "league"));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!balanced ? (
        <Alert>
          <AlertDescription>
            Divisions are unbalanced. Move teams until every column shows{" "}
            {targetCount}/{targetCount}.
          </AlertDescription>
        </Alert>
      ) : null}

      <SettingsFormCard
        title="Realign Divisions"
        footer={
          <PageFormActions float={hasChanges}>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => router.push(settingsHref(slug, "league"))}
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
              disabled={isPending || !hasChanges || !balanced}
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
        }
      >
        <DragDropProvider
          onDragStart={() => {
            previousColumns.current = columns;
          }}
          onDragOver={(event) => {
            setColumns((items) => move(items, event));
          }}
          onDragEnd={(event) => {
            if (event.canceled) {
              setColumns(previousColumns.current);
            }
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {divisions.map((division) => (
              <DivisionColumn
                key={division.id}
                division={division}
                teamIds={columns[division.id] ?? []}
                teamById={teamById}
                targetCount={targetCount}
              />
            ))}
          </div>
        </DragDropProvider>
      </SettingsFormCard>
    </div>
  );
}
