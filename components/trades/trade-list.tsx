"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRightIcon,
  ArrowTurnBackwardIcon,
  Cancel01Icon,
  Delete02Icon,
  OctagonXIcon,
  TickDouble02Icon,
  UserSwitchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { TradeAcceptDialog } from "@/components/trades/trade-accept-dialog";
import {
  TradeCardHeader,
  TradeSidesPanel,
  resolveTradeSideViews,
} from "@/components/trades/trade-display";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
  acceptTrade,
  approveTrade,
  cancelTrade,
  commissionerRejectTrade,
  getTradeAcceptPreview,
  rejectTrade,
  vetoTrade,
} from "@/lib/actions/trades";
import type { TradeAcceptCandidate, TradeActionResult } from "@/lib/actions/trades";
import {
  formatTradeProcessCountdown,
  resolveNextStatusOnAccept,
  reviewEndsAtFromNow,
} from "@/lib/leagues/trades/status";
import type { TradeProcessing } from "@/lib/leagues/transaction-rules";
import { tradeComposerPath } from "@/lib/leagues/utils";
import type { TradeListRow, TradeVetoSummary } from "@/lib/queries/trades";

type TradeListProps = {
  leagueSlug: string;
  trades: TradeListRow[];
  myTeamId: string;
  isCommissioner: boolean;
  tradeProcessing: string;
  allowVetoes?: boolean;
  vetoSummaries?: Record<string, TradeVetoSummary>;
};

type TradeActionKind =
  | "accept"
  | "reject"
  | "cancel"
  | "veto"
  | "approve"
  | "commissioner_reject";

const OPEN_STATUSES = new Set(["pending", "review", "awaiting_commissioner"]);
const PAGE_SIZE = 10;

export function TradeList({
  leagueSlug,
  trades,
  myTeamId,
  isCommissioner,
  tradeProcessing,
  allowVetoes = false,
  vetoSummaries,
}: TradeListProps) {
  const router = useRouter();
  const [localTrades, setLocalTrades] = useState(trades);
  const [localVetos, setLocalVetos] = useState(vetoSummaries ?? {});
  const [acceptTradeId, setAcceptTradeId] = useState<string | null>(null);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [acceptLoadError, setAcceptLoadError] = useState<string | null>(null);
  const [acceptDropsNeeded, setAcceptDropsNeeded] = useState(0);
  const [acceptCandidates, setAcceptCandidates] = useState<
    TradeAcceptCandidate[]
  >([]);
  const [page, setPage] = useState(0);
  const [syncedTrades, setSyncedTrades] = useState(trades);
  if (trades !== syncedTrades) {
    setSyncedTrades(trades);
    setLocalTrades(trades);
  }

  const [syncedVetos, setSyncedVetos] = useState(vetoSummaries);
  if (vetoSummaries !== syncedVetos) {
    setSyncedVetos(vetoSummaries);
    setLocalVetos(vetoSummaries ?? {});
  }

  async function openAcceptDialog(tradeId: string) {
    setAcceptTradeId(tradeId);
    setAcceptLoading(true);
    setAcceptLoadError(null);
    setAcceptDropsNeeded(0);
    setAcceptCandidates([]);

    const result = await getTradeAcceptPreview(leagueSlug, tradeId);
    setAcceptLoading(false);
    if (!result.ok) {
      setAcceptLoadError(result.error);
      return;
    }
    setAcceptDropsNeeded(result.preview.dropsNeeded);
    setAcceptCandidates(result.preview.candidates);
  }

  function applyOptimistic(
    tradeId: string,
    kind: TradeActionKind,
  ): { trades: TradeListRow[]; vetos: Record<string, TradeVetoSummary> } {
    const previous = {
      trades: localTrades,
      vetos: localVetos,
    };

    setLocalTrades((current) =>
      current.map((trade) => {
        if (trade.id !== tradeId) {
          return trade;
        }

        switch (kind) {
          case "accept": {
            const nextStatus = resolveNextStatusOnAccept(
              tradeProcessing as TradeProcessing,
            );
            return {
              ...trade,
              status: nextStatus,
              counterpartyAcceptedAt: new Date(),
              reviewEndsAt:
                nextStatus === "review" ? reviewEndsAtFromNow(24) : null,
            };
          }
          case "reject":
            return { ...trade, status: "rejected" };
          case "cancel":
            return { ...trade, status: "cancelled" };
          case "approve":
            return { ...trade, status: "completed", completedAt: new Date() };
          case "commissioner_reject":
            return { ...trade, status: "commissioner_rejected" };
          case "veto": {
            const summary = localVetos[tradeId];
            const nextCount = (summary?.count ?? 0) + 1;
            const threshold = summary?.threshold ?? 1;
            if (nextCount >= threshold) {
              return { ...trade, status: "vetoed" };
            }
            return trade;
          }
          default:
            return trade;
        }
      }),
    );

    if (kind === "veto") {
      setLocalVetos((current) => {
        const summary = current[tradeId];
        if (!summary) {
          return current;
        }
        return {
          ...current,
          [tradeId]: {
            ...summary,
            count: summary.count + 1,
            myTeamVetoed: true,
          },
        };
      });
    }

    return previous;
  }

  function run(tradeId: string, kind: TradeActionKind, action: () => Promise<TradeActionResult>) {
    const snapshot = applyOptimistic(tradeId, kind);

    void action().then((result) => {
      if (!result.success) {
        setLocalTrades(snapshot.trades);
        setLocalVetos(snapshot.vetos);
        const message =
          result.error ??
          (result.errors?.length ? result.errors.join(" ") : "Action failed.");
        toast.error(message);
        return;
      }
      toast.success("Trade updated");
      router.refresh();
    });
  }

  const openTrades = localTrades.filter((trade) =>
    OPEN_STATUSES.has(trade.status),
  );

  if (openTrades.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={UserSwitchIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>No open trades right now</EmptyTitle>
          <EmptyDescription>
            Propose a trade when you are ready to shake up your roster.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            nativeButton={false}
            render={<Link href={tradeComposerPath(leagueSlug)} />}
          >
            <HugeiconsIcon
              icon={ArrowLeftRightIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Propose Trade
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const pageCount = Math.max(1, Math.ceil(openTrades.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleTrades = openTrades.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-4">
      {visibleTrades.map((trade) => {
        const isProposer = trade.proposingTeamId === myTeamId;
        const isReceiver = trade.receivingTeamId === myTeamId;
        const isInvolved = isProposer || isReceiver;
        const countdown = formatTradeProcessCountdown(trade.reviewEndsAt);
        const veto = localVetos[trade.id];
        const sides = resolveTradeSideViews(trade, myTeamId);

        const showReceiverActions =
          isReceiver && trade.status === "pending";
        const showProposerCancel =
          isProposer && trade.status === "pending";
        const showVeto =
          allowVetoes &&
          trade.status === "review" &&
          !isInvolved &&
          veto &&
          !veto.myTeamVetoed;
        const showCommissionerActions =
          isCommissioner &&
          tradeProcessing === "commissioner" &&
          trade.status === "awaiting_commissioner";
        const hasActions =
          showReceiverActions ||
          showProposerCancel ||
          showVeto ||
          showCommissionerActions;

        return (
          <Card key={trade.id} size="sm">
            <TradeCardHeader
              proposingTeamName={trade.proposingTeamName}
              receivingTeamName={trade.receivingTeamName}
              eyebrow={countdown}
              status={trade.status}
              vetoCount={
                allowVetoes && trade.status === "review"
                  ? veto?.count
                  : undefined
              }
              vetoThreshold={
                allowVetoes && trade.status === "review"
                  ? veto?.threshold
                  : undefined
              }
              myTeamVetoed={veto?.myTeamVetoed}
            />

            <CardContent>
              <TradeSidesPanel
                left={sides.left}
                right={sides.right}
                leagueSlug={leagueSlug}
              />
            </CardContent>

            {hasActions ? (
              <CardFooter className="flex-col-reverse items-stretch gap-2 border-t sm:flex-row sm:items-center sm:justify-end sm:gap-2 sm:*:w-auto *:w-full">
                {showReceiverActions ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run(trade.id, "reject", () =>
                          rejectTrade(leagueSlug, trade.id),
                        )
                      }
                    >
                      <HugeiconsIcon
                        icon={Cancel01Icon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      Reject
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={
                        <Link
                          href={tradeComposerPath(leagueSlug, {
                            with: trade.proposingTeamSlug,
                            want: trade.players
                              .filter(
                                (player) =>
                                  player.teamId === trade.proposingTeamId &&
                                  !player.isDrop,
                              )
                              .map((player) => player.playerId),
                            offer: trade.players
                              .filter(
                                (player) =>
                                  player.teamId === trade.receivingTeamId &&
                                  !player.isDrop,
                              )
                              .map((player) => player.playerId),
                            counter: trade.id,
                          })}
                        />
                      }
                    >
                      <HugeiconsIcon
                        icon={ArrowTurnBackwardIcon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      Counter
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void openAcceptDialog(trade.id)}
                    >
                      <HugeiconsIcon
                        icon={TickDouble02Icon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      Accept
                    </Button>
                  </>
                ) : null}
                {showProposerCancel ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      run(trade.id, "cancel", () =>
                        cancelTrade(leagueSlug, trade.id),
                      )
                    }
                  >
                    <HugeiconsIcon
                      icon={Delete02Icon}
                      strokeWidth={2}
                      data-icon="inline-start"
                    />
                    Cancel Trade
                  </Button>
                ) : null}
                {showVeto ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      run(trade.id, "veto", () =>
                        vetoTrade(leagueSlug, trade.id),
                      )
                    }
                  >
                    <HugeiconsIcon
                      icon={OctagonXIcon}
                      strokeWidth={2}
                      data-icon="inline-start"
                    />
                    Veto
                  </Button>
                ) : null}
                {showCommissionerActions ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run(trade.id, "commissioner_reject", () =>
                          commissionerRejectTrade(leagueSlug, trade.id),
                        )
                      }
                    >
                      <HugeiconsIcon
                        icon={Cancel01Icon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      Cancel trade
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        run(trade.id, "approve", () =>
                          approveTrade(leagueSlug, trade.id),
                        )
                      }
                    >
                      <HugeiconsIcon
                        icon={UserSwitchIcon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      Execute trade
                    </Button>
                  </>
                ) : null}
              </CardFooter>
            ) : null}
          </Card>
        );
      })}

      <TradeAcceptDialog
        open={acceptTradeId != null}
        loading={acceptLoading}
        loadError={acceptLoadError}
        dropsNeeded={acceptDropsNeeded}
        candidates={acceptCandidates}
        leagueSlug={leagueSlug}
        onOpenChange={(open) => {
          if (!open) {
            setAcceptTradeId(null);
            setAcceptLoadError(null);
            setAcceptCandidates([]);
            setAcceptDropsNeeded(0);
          }
        }}
        onConfirm={(dropIds) => {
          if (!acceptTradeId) {
            return;
          }
          const tradeId = acceptTradeId;
          setAcceptTradeId(null);
          run(tradeId, "accept", () =>
            acceptTrade(leagueSlug, tradeId, dropIds),
          );
        }}
      />
      <ListPagination
        page={safePage}
        pageCount={pageCount}
        total={openTrades.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        label={{ singular: "trade", plural: "trades" }}
      />
    </div>
  );
}
