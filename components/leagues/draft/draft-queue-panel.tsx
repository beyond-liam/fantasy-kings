"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SortableList } from "@/components/ui/sortable-list";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import {
  removeFromDraftQueue,
  reorderDraftQueue,
} from "@/lib/actions/draft";
import type { DraftQueueRow } from "@/lib/queries/draft";

type DraftQueuePanelProps = {
  slug: string;
  items: DraftQueueRow[];
};

export function DraftQueuePanel({ slug, items }: DraftQueuePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="w-24">Pos</TableHead>
              <TableHead className="w-24">Team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="p-0">
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyDescription>
                      Queue is empty. Add players from the Player Pool tab.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableShell>
    );
  }

  return (
    <SortableList
      removeDisabled={isPending}
      items={items.map((item) => ({
        id: item.playerId,
        label: `${item.fullName} · ${item.primaryPositionId}${
          item.nflTeam ? ` · ${item.nflTeam}` : ""
        }`,
      }))}
      onReorder={(ids) => {
        startTransition(async () => {
          const result = await reorderDraftQueue(slug, ids);
          if (!result.success) {
            toast.error(result.error ?? "Could not reorder queue.");
            return;
          }
          router.refresh();
        });
      }}
      onRemove={(playerId) => {
        startTransition(async () => {
          const result = await removeFromDraftQueue(slug, playerId);
          if (!result.success) {
            toast.error(result.error ?? "Could not remove player.");
            return;
          }
          router.refresh();
        });
      }}
    />
  );
}
