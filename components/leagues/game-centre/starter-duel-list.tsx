"use client";

import { CheckmarkCircle03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerAvatar } from "@/components/rankings/player-avatar";
import {
  formatPlayerSubtitle,
  PlayerProfileTrigger,
} from "@/components/rankings/player-identity";
import { OpponentCell } from "@/components/team/opponent-cell";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { TableShell } from "@/components/ui/table";
import type {
  GameCentreDuelRow,
  GameCentrePlayer,
} from "@/lib/queries/game-centre";
import {
  POSITION_BADGE_CLASSNAME,
  positionToneClass,
  slotBadgeLabel,
} from "@/lib/leagues/position-colors";
import { resolvePlayerByeWeek } from "@/lib/nfl/bye-weeks";
import { getInjuryIndicator } from "@/lib/players/injury";
import { formatStatValue } from "@/lib/rankings/column-config";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "—";
/** Fixed identity width so opponents line up as a column across rows. */
const PLAYER_IDENTITY = "w-[10.5rem] shrink-0 sm:w-[12rem]";
const OPP_COL = "min-w-0 flex-1";
const PLAYER_CARD =
  "flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 sm:gap-3.5 sm:px-5 sm:py-4";

function formatPts(value: number | null) {
  return formatStatValue(value, 2);
}

/** Sleeper-style compact name: "J. Herbert". */
function shortName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  return `${parts[0]![0]}. ${parts.slice(1).join(" ")}`;
}

function positionTextClass(positionId: string) {
  const classes = positionToneClass(positionId).match(
    /\b(?:dark:)?text-[^\s]+/g,
  );
  return classes?.join(" ") ?? "text-muted-foreground";
}

function shortInjuryLabel(label: string) {
  const compact = label.trim().toUpperCase();
  if (compact.length <= 4) return compact;
  return compact.slice(0, 4);
}

function DuelAvatar({ player }: { player: GameCentrePlayer }) {
  return (
    <PlayerAvatar
      fullName={player.fullName}
      sleeperId={player.sleeperId}
      primaryPositionId={player.primaryPositionId}
      nflTeam={player.nflTeam}
      injuryStatus={player.injuryStatus}
      size="sm"
      hasPossession={player.opponent?.hasPossession}
      inRedZone={player.opponent?.inRedZone}
      isLive={player.opponent?.gameStatus === "in"}
    />
  );
}

function MobilePlayerBlock({
  player,
  align,
  leagueSlug,
}: {
  player: GameCentrePlayer | null;
  align: "away" | "home";
  leagueSlug?: string | null;
}) {
  const isAway = align === "away";
  const alignCls = isAway ? "text-left items-start" : "text-right items-end";

  if (!player) {
    return (
      <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", alignCls)}>
        <span className="text-xs text-muted-foreground">Empty</span>
      </div>
    );
  }

  const bye = resolvePlayerByeWeek({ nflTeam: player.nflTeam });
  const injury = getInjuryIndicator(player.injuryStatus);

  const injuryBadge = injury ? (
    <span
      className={cn(
        "shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase leading-none",
        injury.tone === "questionable"
          ? "bg-warning/20 text-warning"
          : "bg-destructive/20 text-destructive",
      )}
    >
      {shortInjuryLabel(injury.label)}
    </span>
  ) : null;

  return (
    <PlayerProfileTrigger
      playerId={player.id}
      leagueSlug={leagueSlug}
      aria-label={`View ${player.fullName}`}
      className={cn("flex min-w-0 flex-1 flex-col gap-0.5", alignCls)}
    >
      <span
        className={cn(
          "inline-flex w-full min-w-0 items-center gap-1.5 text-xs font-semibold leading-tight",
          !isAway && "justify-end",
        )}
      >
        {isAway ? <DuelAvatar player={player} /> : null}
        <span className="truncate underline-offset-2 group-hover/player-identity:underline group-focus-visible/player-identity:underline">
          {shortName(player.fullName)}
        </span>
        {!isAway ? <DuelAvatar player={player} /> : null}
      </span>

      <div
        className={cn(
          "flex min-w-0 items-center gap-1 text-[10px] leading-tight",
          isAway ? "flex-row" : "flex-row-reverse",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center gap-x-1",
            isAway ? "flex-row" : "flex-row-reverse",
          )}
        >
          <span
            className={cn(
              "shrink-0 font-semibold",
              positionTextClass(player.primaryPositionId),
            )}
          >
            {player.primaryPositionId}
          </span>
          <span className="shrink-0 text-muted-foreground">·</span>
          <span className="min-w-0 truncate text-foreground">
            {player.nflTeam ?? PLACEHOLDER}
            {bye != null ? (
              <span className="text-muted-foreground">{` (${bye})`}</span>
            ) : null}
          </span>
        </div>
        {injuryBadge}
      </div>

      <div
        className={cn(
          "flex w-full min-w-0 items-center gap-1 text-[10px] leading-tight",
          isAway ? "flex-row justify-start" : "flex-row-reverse justify-start",
        )}
      >
        {player.opponent?.kickoffLabel ? (
          <span
            className={cn(
              "min-w-0 truncate whitespace-nowrap",
              player.opponent.gameStatus === "in"
                ? "text-success"
                : "text-muted-foreground",
            )}
          >
            {player.opponent.kickoffLabel}
          </span>
        ) : null}
        {player.opponent?.gameStatus === "in" ? null : (
          <span className="min-w-0 truncate text-foreground">
            {player.opponent?.label ?? PLACEHOLDER}
          </span>
        )}
      </div>
    </PlayerProfileTrigger>
  );
}

function MobileScoreCluster({
  player,
  align,
  onActualClick,
}: {
  player: GameCentrePlayer | null;
  align: "away" | "home";
  onActualClick?: (player: GameCentrePlayer) => void;
}) {
  const projected = player?.projectedPts ?? null;
  const actual = player?.actualPts ?? null;
  const actualClickable = player != null && actual != null && onActualClick;

  return (
    <div
      className={cn(
        "flex w-11 shrink-0 flex-col justify-center gap-0.5 tabular-nums",
        align === "away" ? "items-end" : "items-start",
      )}
    >
      {actualClickable && player ? (
        <button
          type="button"
          onClick={() => onActualClick(player)}
          className="text-[11px] font-semibold leading-none underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {formatPts(actual)}
        </button>
      ) : (
        <span className="text-[11px] font-semibold leading-none">
          {formatPts(actual)}
        </span>
      )}
      <span className="text-[10px] leading-none text-muted-foreground">
        {formatPts(projected)}
      </span>
    </div>
  );
}

function DuelPlayerCard({
  player,
  align,
  leagueSlug,
}: {
  player: GameCentrePlayer | null;
  align: "away" | "home";
  leagueSlug?: string | null;
}) {
  const isAway = align === "away";

  if (!player) {
    return (
      <div
        className={cn(
          PLAYER_CARD,
          isAway ? "flex-row" : "flex-row-reverse",
        )}
      >
        <div className={cn(PLAYER_IDENTITY, "text-sm text-muted-foreground")}>
          Empty
        </div>
        <div className={OPP_COL} aria-hidden />
      </div>
    );
  }

  return (
    <div
      className={cn(
        PLAYER_CARD,
        isAway ? "flex-row" : "flex-row-reverse",
      )}
    >
      <PlayerProfileTrigger
        playerId={player.id}
        leagueSlug={leagueSlug}
        aria-label={`View ${player.fullName}`}
        className={cn(
          "flex min-w-0 items-center gap-2.5",
          PLAYER_IDENTITY,
          isAway ? "flex-row" : "flex-row-reverse",
        )}
      >
        <DuelAvatar player={player} />
        <div
          className={cn(
            "min-w-0 flex-1",
            isAway ? "text-left" : "text-right",
          )}
        >
          <div className="truncate text-sm font-medium leading-snug underline-offset-2 group-hover/player-identity:underline group-focus-visible/player-identity:underline">
            {player.fullName}
          </div>
          <div className="truncate text-xs leading-snug text-muted-foreground">
            {formatPlayerSubtitle({
              primaryPositionId: player.primaryPositionId,
              nflTeam: player.nflTeam,
            })}
          </div>
        </div>
      </PlayerProfileTrigger>

      <OpponentCell
        opponent={player.opponent}
        className={cn(
          OPP_COL,
          "gap-1",
          isAway ? "text-left" : "text-right",
        )}
      />
    </div>
  );
}

function ScoreCluster({
  player,
  align,
  hasAdv,
  showAdv,
  onActualClick,
}: {
  player: GameCentrePlayer | null;
  align: "away" | "home";
  hasAdv: boolean;
  showAdv: boolean;
  onActualClick?: (player: GameCentrePlayer) => void;
}) {
  const isAway = align === "away";
  const projected = player?.projectedPts ?? null;
  const actual = player?.actualPts ?? null;
  const actualClickable =
    player != null &&
    actual != null &&
    onActualClick;

  const check = showAdv ? (
    hasAdv ? (
      <HugeiconsIcon
        icon={CheckmarkCircle03Icon}
        strokeWidth={1.5}
        className="size-5 shrink-0 text-success"
      />
    ) : (
      <span className="size-5 shrink-0" aria-hidden />
    )
  ) : null;

  const scores = (
    <div
      className={cn(
        "flex min-w-[3rem] flex-col justify-center gap-1 tabular-nums",
        isAway ? "items-end" : "items-start",
      )}
    >
      {actualClickable && player ? (
        <button
          type="button"
          onClick={() => onActualClick(player)}
          className="text-sm font-semibold leading-none underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {formatPts(actual)}
        </button>
      ) : (
        <span className="text-sm font-semibold leading-none">
          {formatPts(actual)}
        </span>
      )}
      <span className="text-xs leading-none text-muted-foreground">
        {formatPts(projected)}
      </span>
    </div>
  );

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center gap-3 sm:gap-4",
        isAway ? "flex-row" : "flex-row-reverse",
      )}
    >
      {scores}
      {check}
    </div>
  );
}

function SlotBadge({ slotPositionId }: { slotPositionId: string }) {
  return (
    <span
      className={cn(
        POSITION_BADGE_CLASSNAME,
        "max-md:min-w-8 max-md:px-1 max-md:text-[10px]",
        positionToneClass(slotPositionId),
      )}
    >
      {slotBadgeLabel(slotPositionId)}
    </span>
  );
}

function DuelRow({
  row,
  onActualClick,
  showAdv,
  leagueSlug,
}: {
  row: GameCentreDuelRow;
  onActualClick?: (player: GameCentrePlayer) => void;
  showAdv: boolean;
  leagueSlug?: string | null;
}) {
  return (
    <li className="border-b last:border-b-0">
      {/* Mobile — Sleeper-style compact row, no horizontal scroll */}
      <div className="flex min-w-0 items-center gap-1 px-2 py-2.5 md:hidden">
        <MobilePlayerBlock
          player={row.away}
          align="away"
          leagueSlug={leagueSlug}
        />
        <div className="flex shrink-0 items-center gap-2">
          <MobileScoreCluster
            player={row.away}
            align="away"
            onActualClick={onActualClick}
          />
          <SlotBadge slotPositionId={row.slotPositionId} />
          <MobileScoreCluster
            player={row.home}
            align="home"
            onActualClick={onActualClick}
          />
        </div>
        <MobilePlayerBlock
          player={row.home}
          align="home"
          leagueSlug={leagueSlug}
        />
      </div>

      {/* Desktop — existing duel layout */}
      <div className="hidden items-center md:flex">
        <DuelPlayerCard
          player={row.away}
          align="away"
          leagueSlug={leagueSlug}
        />

        <div className="flex shrink-0 items-center gap-3 px-3 sm:gap-4 sm:px-4">
          <ScoreCluster
            player={row.away}
            align="away"
            hasAdv={showAdv && row.adv === "away"}
            showAdv={showAdv}
            onActualClick={onActualClick}
          />
          <SlotBadge slotPositionId={row.slotPositionId} />
          <ScoreCluster
            player={row.home}
            align="home"
            hasAdv={showAdv && row.adv === "home"}
            showAdv={showAdv}
            onActualClick={onActualClick}
          />
        </div>

        <DuelPlayerCard
          player={row.home}
          align="home"
          leagueSlug={leagueSlug}
        />
      </div>
    </li>
  );
}

type MatchupRosterListProps = {
  title: string;
  rows: GameCentreDuelRow[];
  onActualClick?: (player: GameCentrePlayer) => void;
  emptyMessage: string;
  /** ADV checkmarks — starters only (desktop). */
  showAdv?: boolean;
  leagueSlug?: string | null;
};

export function MatchupRosterList({
  title,
  rows,
  onActualClick,
  emptyMessage,
  showAdv = true,
  leagueSlug,
}: MatchupRosterListProps) {
  if (rows.length === 0) {
    return (
      <TableShell>
        <div className="flex h-10 items-center border-b bg-muted px-4 text-xs font-medium uppercase">
          {title}
        </div>
        <Empty className="border-none" size="sm">
          <EmptyHeader>
            <EmptyTitle>No {title.toLowerCase()} yet</EmptyTitle>
            <EmptyDescription>{emptyMessage}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </TableShell>
    );
  }

  return (
    <TableShell>
      <div className="flex h-10 items-center border-b bg-muted px-4 text-xs font-medium uppercase">
        {title}
      </div>
      <ul>{rows.map((row, index) => (
        <DuelRow
          key={`${title}-${row.slotPositionId}-${index}`}
          row={row}
          onActualClick={onActualClick}
          showAdv={showAdv}
          leagueSlug={leagueSlug}
        />
      ))}</ul>
    </TableShell>
  );
}

export function StarterDuelList({
  rows,
  onActualClick,
  leagueSlug,
}: {
  rows: GameCentreDuelRow[];
  onActualClick?: (player: GameCentrePlayer) => void;
  leagueSlug?: string | null;
}) {
  return (
    <MatchupRosterList
      title="Starters"
      rows={rows}
      onActualClick={onActualClick}
      emptyMessage="No starters set for this matchup."
      leagueSlug={leagueSlug}
    />
  );
}
