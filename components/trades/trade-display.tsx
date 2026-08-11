"use client";

import { ArrowLeftRightIcon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerIdentity } from "@/components/rankings/player-identity";
import { TradeStatusBadge } from "@/components/trades/trade-status-badge";
import { CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TradeListPlayer, TradeListRow } from "@/lib/queries/trades";
import { cn } from "@/lib/utils";

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
  className,
}: {
  proposingTeamName: string;
  receivingTeamName: string;
  className?: string;
}) {
  return (
    <CardTitle
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-pretty sm:gap-2",
        className,
      )}
    >
      <span className="inline-flex min-w-0 shrink items-center gap-1.5">
        <TradeProposerMark teamName={proposingTeamName} />
        <span className="truncate">{proposingTeamName}</span>
      </span>
      <HugeiconsIcon
        icon={ArrowLeftRightIcon}
        strokeWidth={2}
        className="size-3.5 shrink-0 text-muted-foreground sm:size-4"
      />
      <span className="min-w-0 shrink truncate">{receivingTeamName}</span>
    </CardTitle>
  );
}

/** Shared open/history card chrome: eyebrow → parties → status. */
export function TradeCardHeader({
  proposingTeamName,
  receivingTeamName,
  eyebrow,
  status,
  vetoCount,
  vetoThreshold,
  myTeamVetoed,
}: {
  proposingTeamName: string;
  receivingTeamName: string;
  eyebrow?: string | null;
  status: string;
  vetoCount?: number;
  vetoThreshold?: number;
  myTeamVetoed?: boolean;
}) {
  return (
    <CardHeader className="border-b gap-2">
      {eyebrow ? (
        <p className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
          {eyebrow}
        </p>
      ) : null}
      <TradePartiesTitle
        proposingTeamName={proposingTeamName}
        receivingTeamName={receivingTeamName}
      />
      <TradeStatusBadge
        status={status}
        vetoCount={vetoCount}
        vetoThreshold={vetoThreshold}
        myTeamVetoed={myTeamVetoed}
      />
    </CardHeader>
  );
}


function TradeSideColumn({
  label,
  players,
  leagueSlug,
  className,
}: {
  label: string;
  players: TradeListPlayer[];
  leagueSlug: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <p className="truncate text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <ul className="flex flex-col gap-2">
        {players.length === 0 ? (
          <li className="text-xs text-muted-foreground">—</li>
        ) : (
          players.map((player) => (
            <li key={player.playerId} className="min-w-0">
              <PlayerIdentity
                fullName={player.playerName}
                sleeperId={player.sleeperId}
                primaryPositionId={player.primaryPositionId}
                nflTeam={player.nflTeam}
                size="sm"
                playerId={player.playerId}
                leagueSlug={leagueSlug}
              />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** Receive / give columns — always two-up so mobile cards stay short. */
export function TradeSidesPanel({
  left,
  right,
  leagueSlug,
  className,
}: {
  left: TradeSideView;
  right: TradeSideView;
  leagueSlug: string;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-3", className)}>
      <TradeSideColumn
        label={left.label}
        players={left.players}
        leagueSlug={leagueSlug}
      />
      <TradeSideColumn
        label={right.label}
        players={right.players}
        leagueSlug={leagueSlug}
        className="border-l border-border/70 pl-3"
      />
    </div>
  );
}
