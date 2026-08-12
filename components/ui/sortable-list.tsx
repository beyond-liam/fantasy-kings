"use client";

import { useMemo, type ReactNode } from "react";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  Delete02Icon,
  DragDropVerticalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SortableListItem = {
  id: string;
  /** Used for aria labels. */
  label: string;
  /** Optional rich content; defaults to `label`. */
  content?: ReactNode;
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
  const { ref, handleRef, isDragging } = useSortable({
    id: item.id,
    index,
  });

  return (
    <li
      ref={ref}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5",
        isDragging && "shadow-md",
      )}
    >
      <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <Button
        ref={handleRef}
        type="button"
        variant="secondary"
        size="icon-sm"
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label={`Drag to reorder ${item.label}`}
      >
        <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} />
      </Button>
      <span className="min-w-0 flex-1 text-sm">
        {item.content ?? item.label}
      </span>
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
  const ids = useMemo(() => items.map((item) => item.id), [items]);

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) {
          return;
        }
        const next = move(ids, event);
        if (next !== ids) {
          onReorder(next.map(String));
        }
      }}
    >
      <ol className="flex flex-col gap-2">
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
    </DragDropProvider>
  );
}
