"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
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
  Delete02Icon,
  DragDropVerticalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SortableListItem = {
  id: string;
  label: string;
};

type SortableListProps = {
  items: SortableListItem[];
  onReorder: (ids: string[]) => void;
  onRemove?: (id: string) => void;
  removeDisabled?: boolean;
};

function SortableRow({
  item,
  index,
  onRemove,
  removeDisabled,
}: {
  item: SortableListItem;
  index: number;
  onRemove?: (id: string) => void;
  removeDisabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5",
        isDragging && "z-10 shadow-md",
      )}
    >
      <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label={`Drag to reorder ${item.label}`}
        {...attributes}
        {...listeners}
      >
        <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} />
      </Button>
      <span className="min-w-0 flex-1 text-sm">{item.label}</span>
      {onRemove ? (
        <Button
          type="button"
          variant="ghost-destructive"
          size="icon-sm"
          disabled={removeDisabled}
          aria-label={`Remove ${item.label}`}
          onClick={() => onRemove(item.id)}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
        </Button>
      ) : null}
    </li>
  );
}

export function SortableList({
  items,
  onReorder,
  onRemove,
  removeDisabled,
}: SortableListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const ids = useMemo(() => items.map((item) => item.id), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className={cn("flex flex-col gap-2", activeId && "select-none")}>
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              item={item}
              index={index}
              onRemove={onRemove}
              removeDisabled={removeDisabled}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
