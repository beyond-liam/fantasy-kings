"use client";

import { useState } from "react";
import { HistoryIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  TradeCardHeader,
  TradeSidesPanel,
  resolveTradeSideViews,
} from "@/components/trades/trade-display";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTradeStatusLabel } from "@/lib/leagues/trades/status";
import type { TradeListRow } from "@/lib/queries/trades";

const CLOSED_STATUSES = [
  "completed",
  "rejected",
  "cancelled",
  "expired",
  "commissioner_rejected",
  "vetoed",
  "invalidated",
] as const;

const CLOSED_STATUS_SET = new Set<string>(CLOSED_STATUSES);

const ALL_STATUSES = "all";
const PAGE_SIZE = 10;

type TradeHistoryProps = {
  trades: TradeListRow[];
  myTeamId: string;
  leagueSlug: string;
  description?: string;
};

function formatTradeDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export function TradeHistory({
  trades,
  myTeamId,
  leagueSlug,
  description,
}: TradeHistoryProps) {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);

  const closed = trades.filter((trade) => CLOSED_STATUS_SET.has(trade.status));
  if (closed.length === 0) {
    return null;
  }

  const statusItems = [
    { value: ALL_STATUSES, label: "All" },
    ...CLOSED_STATUSES.filter((status) =>
      closed.some((trade) => trade.status === status),
    ).map((status) => ({
      value: status,
      label: formatTradeStatusLabel(status),
    })),
  ];

  const filtered =
    statusFilter === ALL_STATUSES
      ? closed
      : closed.filter((trade) => trade.status === statusFilter);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  return (
    <section className="flex flex-col gap-3 sm:gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight text-balance">
            Trade History
          </h2>
          {description ? (
            <p className="text-sm text-pretty text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <Select
          items={statusItems}
          value={statusFilter}
          onValueChange={(value) => {
            if (value) {
              setStatusFilter(value);
              setPage(0);
            }
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-fit max-w-full shrink-0"
            aria-label="Filter trade history by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end" alignItemWithTrigger={false}>
            <SelectGroup>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={HistoryIcon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No trades with this status.</EmptyTitle>
            <EmptyDescription>
              Try another filter or check back after more trades process.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((trade) => {
            const sides = resolveTradeSideViews(trade, myTeamId, "past");

            return (
              <Card key={trade.id} id={`trade-${trade.id}`} size="sm" className="scroll-mt-4">
                <TradeCardHeader
                  proposingTeamName={trade.proposingTeamName}
                  receivingTeamName={trade.receivingTeamName}
                  eyebrow={formatTradeDate(trade.createdAt)}
                  status={trade.status}
                />

                <CardContent>
                  <TradeSidesPanel
                    left={sides.left}
                    right={sides.right}
                    leagueSlug={leagueSlug}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ListPagination
        page={safePage}
        pageCount={pageCount}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        label={{ singular: "trade", plural: "trades" }}
      />
    </section>
  );
}
