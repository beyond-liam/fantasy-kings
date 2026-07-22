"use client";

import { useState } from "react";
import { ArrowLeftRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerIdentity } from "@/components/rankings/player-identity";
import { TradeStatusBadge } from "@/components/trades/trade-status-badge";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  description?: string;
};

function playersForTeam(trade: TradeListRow, teamId: string, isDrop = false) {
  return trade.players.filter(
    (player) => player.teamId === teamId && player.isDrop === isDrop,
  );
}

function formatTradeDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export function TradeHistory({
  trades,
  myTeamId,
  description,
}: TradeHistoryProps) {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);

  const closed = trades.filter((trade) => CLOSED_STATUS_SET.has(trade.status));
  if (closed.length === 0) {
    return null;
  }

  const statusItems = [
    { value: ALL_STATUSES, label: "All statuses" },
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
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
            className="w-48 shrink-0"
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
        <p className="text-sm text-muted-foreground">
          No trades with this status.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((trade) => {
            const isProposer = trade.proposingTeamId === myTeamId;
            const isReceiver = trade.receivingTeamId === myTeamId;
            const myGets = isProposer
              ? playersForTeam(trade, trade.receivingTeamId)
              : isReceiver
                ? playersForTeam(trade, trade.proposingTeamId)
                : [];
            const myGives = isProposer
              ? playersForTeam(trade, trade.proposingTeamId)
              : isReceiver
                ? playersForTeam(trade, trade.receivingTeamId)
                : [];

            return (
              <Card key={trade.id} size="sm">
                <CardHeader className="border-b">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <span>{trade.proposingTeamName}</span>
                    <HugeiconsIcon
                      icon={ArrowLeftRightIcon}
                      strokeWidth={2}
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span>{trade.receivingTeamName}</span>
                  </CardTitle>
                  <CardDescription>
                    {formatTradeDate(trade.createdAt)}
                  </CardDescription>
                  <CardAction>
                    <TradeStatusBadge status={trade.status} />
                  </CardAction>
                </CardHeader>

                {isProposer || isReceiver ? (
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          You received
                        </p>
                        <ul className="flex flex-col gap-2">
                          {myGets.map((player) => (
                            <li key={player.playerId}>
                              <PlayerIdentity
                                fullName={player.playerName}
                                sleeperId={player.sleeperId}
                                primaryPositionId={player.primaryPositionId}
                                nflTeam={player.nflTeam}
                                size="sm"
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          You gave
                        </p>
                        <ul className="flex flex-col gap-2">
                          {myGives.map((player) => (
                            <li key={player.playerId}>
                              <PlayerIdentity
                                fullName={player.playerName}
                                sleeperId={player.sleeperId}
                                primaryPositionId={player.primaryPositionId}
                                nflTeam={player.nflTeam}
                                size="sm"
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                ) : null}
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
