"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  Delete02Icon,
  DragDropVerticalIcon,
  Edit02Icon,
  FlashIcon,
  SquareLock02Icon,
  UserAdd01Icon,
  UserGroupIcon,
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  cancelWaiverClaim,
  processWaiverClaimsNow,
  reorderWaiverClaims,
} from "@/lib/actions/waivers";
import type { WaiverProcessDay } from "@/db/schema/league-seasons";
import type { PendingWaiverClaimRow } from "@/lib/queries/waivers";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const CLAIMS_LOCKED_TOOLTIP =
  "Claim order is locked during the waiver processing window";

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
  claimsLocked: boolean;
  resetOrderWeekly: boolean;
  fcfsMode: "after_process" | "never";
  processDays: WaiverProcessDay[];
};

function ClaimsLockedHint({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={<span className="inline-flex cursor-default" />}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent>{CLAIMS_LOCKED_TOOLTIP}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ClaimCardContent({
  claim,
  displayIndex,
  isFaab,
  actionsDisabled,
  claimsLocked,
  leagueSlug,
  onCancel,
  onEdit,
  leadingControl,
}: {
  claim: PendingWaiverClaimRow;
  displayIndex: number;
  isFaab: boolean;
  actionsDisabled: boolean;
  claimsLocked: boolean;
  leagueSlug: string;
  onCancel: () => void;
  onEdit: () => void;
  leadingControl: ReactNode;
}) {
  return (
    <CardContent className="grid grid-cols-[auto_2ch_minmax(0,1fr)] items-start gap-x-2 gap-y-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
      {leadingControl}
      <span className="pt-2 text-end text-sm tabular-nums text-muted-foreground sm:w-6 sm:shrink-0 sm:pt-0 sm:text-center">
        {displayIndex}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-1">
        <PlayerIdentity
          fullName={claim.playerName}
          sleeperId={claim.sleeperId}
          primaryPositionId={claim.primaryPositionId}
          nflTeam={claim.nflTeam}
          record={isFaab && claim.bid != null ? `$${claim.bid}` : null}
          size="sm"
          playerId={claim.playerId}
          leagueSlug={leagueSlug}
        />
        {claim.dropPlayerName ? (
          <p className="text-xs text-pretty text-muted-foreground">
            Drop {claim.dropPlayerName}
          </p>
        ) : null}
      </div>
      <div className="col-span-3 flex gap-2 sm:col-auto sm:ml-auto sm:shrink-0 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9 min-w-0 flex-1 sm:flex-none"
          disabled={actionsDisabled}
          onClick={onCancel}
        >
          <HugeiconsIcon
            icon={Delete02Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Cancel Claim
        </Button>
        {isFaab ? (
          claimsLocked ? (
            <ClaimsLockedHint>
              <Button
                type="button"
                size="sm"
                className="min-h-9 min-w-0 flex-1 sm:flex-none"
                disabled
              >
                <HugeiconsIcon
                  icon={SquareLock02Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Edit claim
              </Button>
            </ClaimsLockedHint>
          ) : (
            <Button
              type="button"
              size="sm"
              className="min-h-9 min-w-0 flex-1 sm:flex-none"
              disabled={actionsDisabled}
              onClick={onEdit}
            >
              <HugeiconsIcon
                icon={Edit02Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Edit claim
            </Button>
          )
        ) : null}
      </div>
    </CardContent>
  );
}

function SortableClaimCard({
  claim,
  index,
  displayIndex,
  isFaab,
  disabled,
  leagueSlug,
  onCancel,
  onEdit,
}: {
  claim: PendingWaiverClaimRow;
  index: number;
  displayIndex: number;
  isFaab: boolean;
  disabled: boolean;
  leagueSlug: string;
  onCancel: () => void;
  onEdit: () => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: claim.id,
    index,
    disabled,
  });

  return (
    <Card
      ref={ref}
      size="sm"
      className={cn(isDragging && "bg-background shadow-md")}
    >
      <ClaimCardContent
        claim={claim}
        displayIndex={displayIndex}
        isFaab={isFaab}
        actionsDisabled={disabled}
        claimsLocked={false}
        leagueSlug={leagueSlug}
        onCancel={onCancel}
        onEdit={onEdit}
        leadingControl={
          <Button
            ref={handleRef}
            type="button"
            variant="secondary"
            size="icon-sm"
            className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing sm:mt-0"
            aria-label={`Drag to reorder claim for ${claim.playerName}`}
            disabled={disabled}
          >
            <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} />
          </Button>
        }
      />
    </Card>
  );
}

function LockedClaimCard({
  claim,
  displayIndex,
  isFaab,
  actionsDisabled,
  leagueSlug,
  onCancel,
}: {
  claim: PendingWaiverClaimRow;
  displayIndex: number;
  isFaab: boolean;
  actionsDisabled: boolean;
  leagueSlug: string;
  onCancel: () => void;
}) {
  return (
    <Card size="sm">
      <ClaimCardContent
        claim={claim}
        displayIndex={displayIndex}
        isFaab={isFaab}
        actionsDisabled={actionsDisabled}
        claimsLocked
        leagueSlug={leagueSlug}
        onCancel={onCancel}
        onEdit={() => {}}
        leadingControl={
          <ClaimsLockedHint>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              className="mt-0.5 shrink-0 text-muted-foreground sm:mt-0"
              aria-label="Claim locked while waivers are processing"
              disabled
            >
              <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={2} />
            </Button>
          </ClaimsLockedHint>
        }
      />
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
  claimsLocked,
}: TeamWaiversSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editClaim, setEditClaim] = useState<EditClaimDialogState | null>(null);
  const [orderedClaims, setOrderedClaims] = useState(claims);
  const [page, setPage] = useState(0);
  const [syncedClaims, setSyncedClaims] = useState(claims);
  if (claims !== syncedClaims) {
    setSyncedClaims(claims);
    setOrderedClaims(claims);
    setPage(0);
  }

  const isFaab = waiverType === "faab";
  const spendableFaab = faabRemaining ?? 0;
  const pageCount = Math.max(1, Math.ceil(orderedClaims.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageClaims = orderedClaims.slice(pageStart, pageStart + PAGE_SIZE);
  const claimIds = pageClaims.map((claim) => claim.id);
  const distinctProcessLabels = new Set(
    orderedClaims
      .map((claim) => claim.processLabel)
      .filter((label): label is string => Boolean(label)),
  );
  const showProcessGroups = distinctProcessLabels.size > 1;

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

  return (
    <div className="flex flex-col gap-6">
      {orderedClaims.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No pending claims</EmptyTitle>
            <EmptyDescription>
              Claims you file from Players will show up here until processing.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              nativeButton={false}
              render={<Link href={`/league/${leagueSlug}/players`} />}
            >
              <HugeiconsIcon
                icon={UserGroupIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Browse Players
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold tracking-tight">
                Pending Claims
              </h2>
              {!showProcessGroups ? (
                <p className="text-sm text-muted-foreground">
                  {nextProcessLabel
                    ? `Next process ${nextProcessLabel}`
                    : "No upcoming waiver process scheduled"}
                </p>
              ) : null}
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
                Process Now ({pendingSeasonCount})
              </Button>
            ) : null}
          </div>

          <DragDropProvider
            onDragEnd={(event) => {
              if (event.canceled || isPending || claimsLocked) {
                return;
              }

              const nextPageIds = move(claimIds, event);
              if (nextPageIds === claimIds) {
                return;
              }

              const byId = new Map(
                pageClaims.map((claim) => [claim.id, claim] as const),
              );
              const nextPage = nextPageIds.flatMap((id) => {
                const claim = byId.get(String(id));
                return claim ? [claim] : [];
              });
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
            }}
          >
            <div className="flex flex-col gap-4">
              {pageClaims.map((claim, index) => {
                const displayIndex = pageStart + index + 1;
                const prevLabel =
                  index > 0
                    ? pageClaims[index - 1]?.processLabel
                    : pageStart > 0
                      ? orderedClaims[pageStart - 1]?.processLabel
                      : null;
                const showProcessHeader =
                  showProcessGroups &&
                  Boolean(claim.processLabel) &&
                  claim.processLabel !== prevLabel;

                return (
                  <div key={claim.id} className="flex flex-col gap-3">
                    {showProcessHeader ? (
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Processes {claim.processLabel}
                      </h3>
                    ) : null}
                    {claimsLocked ? (
                      <LockedClaimCard
                        claim={claim}
                        displayIndex={displayIndex}
                        isFaab={isFaab}
                        actionsDisabled={isPending}
                        leagueSlug={leagueSlug}
                        onCancel={() => handleCancel(claim.id)}
                      />
                    ) : (
                      <SortableClaimCard
                        claim={claim}
                        index={index}
                        displayIndex={displayIndex}
                        isFaab={isFaab}
                        disabled={isPending}
                        leagueSlug={leagueSlug}
                        onCancel={() => handleCancel(claim.id)}
                        onEdit={() =>
                          setEditClaim({
                            open: true,
                            claimId: claim.id,
                            playerId: claim.playerId,
                            playerName: claim.playerName,
                            sleeperId: claim.sleeperId,
                            primaryPositionId: claim.primaryPositionId,
                            nflTeam: claim.nflTeam,
                            bid: claim.bid ?? 0,
                          })
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </DragDropProvider>

          <ListPagination
            page={safePage}
            pageCount={pageCount}
            total={orderedClaims.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            label={{ singular: "claim", plural: "claims" }}
          />
        </>
      )}

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
