"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PlayerProfileTrigger } from "@/components/rankings/player-identity";
import { SortableList } from "@/components/ui/sortable-list";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
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
  const leagueSlug = slug === "mock" ? undefined : slug;

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
                <Empty className="border-none py-10" size="sm">
                  <EmptyHeader>
                    <EmptyTitle>Queue is empty</EmptyTitle>
                    <EmptyDescription>
                      Add players from the Player Pool tab.
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
        label: item.fullName,
        content: (
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <PlayerProfileTrigger
              playerId={item.playerId}
              leagueSlug={leagueSlug}
              aria-label={`View ${item.fullName}`}
              className="font-medium underline-offset-2 group-hover/player-identity:underline group-focus-visible/player-identity:underline"
            >
              {item.fullName}
            </PlayerProfileTrigger>
            <span className="text-muted-foreground">
              · {item.primaryPositionId}
              {item.nflTeam ? ` · ${item.nflTeam}` : ""}
            </span>
          </span>
        ),
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
