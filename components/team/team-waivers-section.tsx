"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  Cancel01Icon,
  DragDropVerticalIcon,
  Edit02Icon,
  FlashIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import {
  EditClaimDialog,
  type EditClaimDialogState,
} from "@/components/team/edit-claim-dialog";
import { PlayerIdentity } from "@/components/rankings/player-identity";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  cancelWaiverClaim,
  processWaiverClaimsNow,
  reorderWaiverClaims,
} from "@/lib/actions/waivers";
import type { WaiverProcessDay } from "@/db/schema/league-seasons";
import type { PendingWaiverClaimRow } from "@/lib/queries/waivers";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type TeamWaiversSectionProps = {
  leagueSlug: string;
  claims: PendingWaiverClaimRow[];
  waiverType: "priority" | "faab";
  faabRemaining: number | null;
  allowZeroBids: boolean;
  isCommissioner: boolean;
  pendingSeasonCount: number;
  nextProcessLabel: string | null;
  lastProcessLabel: string | null;
  resetOrderWeekly: boolean;
  fcfsMode: "after_process" | "never";
  processDays: WaiverProcessDay[];
};

function SortableClaimCard({
  claim,
  index,
  isFaab,
  disabled,
  onCancel,
  onEdit,
}: {
  claim: PendingWaiverClaimRow;
  index: number;
  isFaab: boolean;
  disabled: boolean;
  onCancel: () => void;
  onEdit: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: claim.id });

  return (
    <Card
      ref={setNodeRef}
      size="sm"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "z-10 shadow-md")}
    >
      <CardContent className="flex flex-wrap items-center gap-3">
        <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">
          {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          aria-label={`Drag to reorder claim for ${claim.playerName}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <PlayerIdentity
            fullName={claim.playerName}
            sleeperId={claim.sleeperId}
            primaryPositionId={claim.primaryPositionId}
            nflTeam={claim.nflTeam}
            record={isFaab && claim.bid != null ? `$${claim.bid}` : null}
            size="sm"
          />
          {claim.dropPlayerName ? (
            <p className="text-xs text-muted-foreground">
              Drop {claim.dropPlayerName}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onCancel}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Cancel
          </Button>
          {isFaab ? (
            <Button type="button" size="sm" disabled={disabled} onClick={onEdit}>
              <HugeiconsIcon
                icon={Edit02Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Edit claim
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function TeamWaiversSection({
  leagueSlug,
  claims,
  waiverType,
  faabRemaining,
  allowZeroBids,
  isCommissioner,
  pendingSeasonCount,
  nextProcessLabel,
}: TeamWaiversSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editClaim, setEditClaim] = useState<EditClaimDialogState | null>(null);
  const [orderedClaims, setOrderedClaims] = useState(claims);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setOrderedClaims(claims);
    setPage(0);
  }, [claims]);

  const isFaab = waiverType === "faab";
  const spendableFaab = faabRemaining ?? 0;
  const pageCount = Math.max(1, Math.ceil(orderedClaims.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageClaims = orderedClaims.slice(pageStart, pageStart + PAGE_SIZE);
  const claimIds = pageClaims.map((claim) => claim.id);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleCancel = (claimId: string) => {
    startTransition(async () => {
      const result = await cancelWaiverClaim(leagueSlug, claimId);
      if (!result.success) {
        toast.error(result.error ?? "Could not cancel claim.");
        return;
      }
      toast.success(
        result.playerName
          ? `Cancelled claim for ${result.playerName}`
          : "Claim cancelled",
      );
      router.refresh();
    });
  };

  const handleProcess = () => {
    startTransition(async () => {
      const result = await processWaiverClaimsNow(leagueSlug);
      if (!result.success) {
        toast.error(result.error ?? "Could not process waivers.");
        return;
      }
      toast.success(
        `Processed waivers: ${result.awarded ?? 0} awarded, ${result.failed ?? 0} failed`,
      );
      router.refresh();
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = claimIds.indexOf(String(active.id));
    const newIndex = claimIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const nextPage = arrayMove(pageClaims, oldIndex, newIndex);
    const next = [
      ...orderedClaims.slice(0, pageStart),
      ...nextPage,
      ...orderedClaims.slice(pageStart + PAGE_SIZE),
    ];
    const nextIds = next.map((claim) => claim.id);
    setOrderedClaims(next);

    startTransition(async () => {
      const result = await reorderWaiverClaims(leagueSlug, nextIds);
      if (!result.success) {
        toast.error(result.error ?? "Could not reorder claims.");
        setOrderedClaims(claims);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Pending Claims
          </h2>
          <p className="text-sm text-muted-foreground">
            {nextProcessLabel
              ? `Waivers will next process at ${nextProcessLabel} UTC`
              : "No upcoming waiver process scheduled"}
          </p>
        </div>
        {isCommissioner ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending || pendingSeasonCount === 0}
            onClick={handleProcess}
          >
            <HugeiconsIcon
              icon={FlashIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Process now ({pendingSeasonCount})
          </Button>
        ) : null}
      </div>

      {orderedClaims.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No pending claims</EmptyTitle>
            <EmptyDescription>
              Claims you file from Players will show up here until processing.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={claimIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-4">
              {pageClaims.map((claim, index) => (
                <SortableClaimCard
                  key={claim.id}
                  claim={claim}
                  index={pageStart + index}
                  isFaab={isFaab}
                  disabled={isPending}
                  onCancel={() => handleCancel(claim.id)}
                  onEdit={() =>
                    setEditClaim({
                      open: true,
                      claimId: claim.id,
                      playerName: claim.playerName,
                      sleeperId: claim.sleeperId,
                      primaryPositionId: claim.primaryPositionId,
                      nflTeam: claim.nflTeam,
                      bid: claim.bid ?? 0,
                    })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <ListPagination
        page={safePage}
        pageCount={pageCount}
        total={orderedClaims.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        label={{ singular: "claim", plural: "claims" }}
      />

      {isFaab ? (
        <EditClaimDialog
          leagueSlug={leagueSlug}
          state={editClaim}
          faabRemaining={spendableFaab}
          allowZeroBids={allowZeroBids}
          onOpenChange={(open) => {
            if (!open) {
              setEditClaim(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
