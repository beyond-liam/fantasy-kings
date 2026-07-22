"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Cancel01Icon,
  DragDropVerticalIcon,
  TickDouble02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { settingsHref } from "@/lib/leagues/settings-tabs";

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

function SortableTeamCard({
  team,
  isOverlay = false,
}: {
  team: RealignTeam;
  isOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: team.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-2 py-2 shadow-xs",
        isDragging && !isOverlay && "opacity-40",
        isOverlay && "shadow-md",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label={`Drag ${team.name}`}
        {...attributes}
        {...listeners}
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
  const { setNodeRef, isOver } = useDroppable({ id: division.id });
  const balancedHere = teamIds.length === targetCount;

  return (
    <Card
      size="sm"
      className={cn("gap-0 py-0", isOver && "ring-2 ring-primary/40")}
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
        <SortableContext
          id={division.id}
          items={teamIds}
          strategy={verticalListSortingStrategy}
        >
          <ol ref={setNodeRef} className="flex min-h-24 flex-col gap-2">
            {teamIds.map((id) => {
              const team = teamById.get(id);
              if (!team) return null;
              return <SortableTeamCard key={id} team={team} />;
            })}
          </ol>
        </SortableContext>
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
  const [activeId, setActiveId] = useState<string | null>(null);
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findContainer = (id: string) => {
    if (id in columns) return id;
    return (
      Object.entries(columns).find(([, teamIds]) => teamIds.includes(id))?.[0] ??
      null
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeTeamId = String(active.id);
    const overId = String(over.id);
    const from = findContainer(activeTeamId);
    const to = findContainer(overId);
    if (!from || !to) return;

    if (from === to) {
      const items = columns[from] ?? [];
      const oldIndex = items.indexOf(activeTeamId);
      const newIndex = items.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      setColumns((prev) => ({
        ...prev,
        [from]: arrayMove(items, oldIndex, newIndex),
      }));
      return;
    }

    setColumns((prev) => {
      const fromItems = [...(prev[from] ?? [])];
      const toItems = [...(prev[to] ?? [])];
      const fromIndex = fromItems.indexOf(activeTeamId);
      if (fromIndex < 0) return prev;
      fromItems.splice(fromIndex, 1);
      const overIndex = toItems.indexOf(overId);
      if (overIndex >= 0) {
        toItems.splice(overIndex, 0, activeTeamId);
      } else {
        toItems.push(activeTeamId);
      }
      return { ...prev, [from]: fromItems, [to]: toItems };
    });
  };

  const activeTeam = activeId ? teamById.get(activeId) : null;

  const handleSave = () => {
    if (!balanced) {
      setError("Divisions must be balanced before saving.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await realignDivisions(slug, assignments);
      if (!result.success) {
        setError(result.error ?? "Could not realign divisions.");
        return;
      }
      router.push(settingsHref(slug, "league"));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Realign Divisions
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Drag teams between divisions. Each division must have the same number
          of teams before you can save.
        </p>
      </div>

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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
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
        <DragOverlay>
          {activeTeam ? (
            <SortableTeamCard team={activeTeam} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <PageFormActions>
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
    </div>
  );
}
