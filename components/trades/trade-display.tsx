"use client";

import { ArrowLeftRightIcon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TradeListPlayer, TradeListRow } from "@/lib/queries/trades";

export function playersForTeam(
  trade: TradeListRow,
  teamId: string,
  isDrop = false,
) {
  return trade.players.filter(
    (player) => player.teamId === teamId && player.isDrop === isDrop,
  );
}

type TradeSideView = {
  label: string;
  players: TradeListPlayer[];
};

/** Column labels/players for league-visible trade cards. */
export function resolveTradeSideViews(
  trade: TradeListRow,
  myTeamId: string,
  tense: "present" | "past" = "present",
): { left: TradeSideView; right: TradeSideView } {
  const isProposer = trade.proposingTeamId === myTeamId;
  const isReceiver = trade.receivingTeamId === myTeamId;

  if (isProposer || isReceiver) {
    const receiveFrom = isProposer
      ? trade.receivingTeamId
      : trade.proposingTeamId;
    const giveFrom = isProposer
      ? trade.proposingTeamId
      : trade.receivingTeamId;

    return {
      left: {
        label: tense === "past" ? "You received" : "You receive",
        players: playersForTeam(trade, receiveFrom),
      },
      right: {
        label: tense === "past" ? "You gave" : "You offer",
        players: playersForTeam(trade, giveFrom),
      },
    };
  }

  const receiveVerb = tense === "past" ? "received" : "receives";
  return {
    left: {
      label: `${trade.proposingTeamName} ${receiveVerb}`,
      players: playersForTeam(trade, trade.receivingTeamId),
    },
    right: {
      label: `${trade.receivingTeamName} ${receiveVerb}`,
      players: playersForTeam(trade, trade.proposingTeamId),
    },
  };
}

function TradeProposerMark({ teamName }: { teamName: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className="inline-flex shrink-0"
              aria-label={`${teamName} proposed this trade`}
            />
          }
        >
          <HugeiconsIcon
            icon={CheckmarkCircle01Icon}
            strokeWidth={2}
            className="size-3 text-emerald-500"
          />
        </TooltipTrigger>
        <TooltipContent>{teamName} proposed this trade</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TradePartiesTitle({
  proposingTeamName,
  receivingTeamName,
}: {
  proposingTeamName: string;
  receivingTeamName: string;
}) {
  return (
    <CardTitle className="flex flex-wrap items-center gap-2">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <TradeProposerMark teamName={proposingTeamName} />
        <span className="truncate">{proposingTeamName}</span>
      </span>
      <HugeiconsIcon
        icon={ArrowLeftRightIcon}
        strokeWidth={2}
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span className="truncate">{receivingTeamName}</span>
    </CardTitle>
  );
}
