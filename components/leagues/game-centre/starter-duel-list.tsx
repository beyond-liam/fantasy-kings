"use client";

import { CheckmarkCircle03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { formatPlayerSubtitle } from "@/components/rankings/player-identity";
import { OpponentCell } from "@/components/team/opponent-cell";
import { TableShell } from "@/components/ui/table";
import type {
  GameCentreDuelRow,
  GameCentrePlayer,
} from "@/lib/queries/game-centre";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "—";
/** Fixed identity width so opponents line up as a column across rows. */
const PLAYER_IDENTITY = "w-[10.5rem] shrink-0 sm:w-[12rem]";
const OPP_COL = "w-[4.5rem] shrink-0 sm:w-[5rem]";
const PLAYER_CARD =
  "flex shrink-0 items-center gap-3 px-4 py-3.5 sm:gap-3.5 sm:px-5 sm:py-4";

function formatPts(value: number | null, digits = 2) {
  if (value == null || !Number.isFinite(value)) return PLACEHOLDER;
  return value.toFixed(digits);
}

function DuelPlayerCard({
  player,
  align,
}: {
  player: GameCentrePlayer | null;
  align: "away" | "home";
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
      <div
        className={cn(
          "flex min-w-0 items-center gap-2.5",
          PLAYER_IDENTITY,
          isAway ? "flex-row" : "flex-row-reverse",
        )}
      >
        <PlayerAvatar
          fullName={player.fullName}
          sleeperId={player.sleeperId}
          primaryPositionId={player.primaryPositionId}
          nflTeam={player.nflTeam}
          injuryStatus={player.injuryStatus}
          size="sm"
        />
        <div
          className={cn(
            "min-w-0 flex-1",
            isAway ? "text-left" : "text-right",
          )}
        >
          <div className="truncate text-sm font-medium leading-snug">
            {player.fullName}
          </div>
          <div className="truncate text-xs leading-snug text-muted-foreground">
            {formatPlayerSubtitle({
              primaryPositionId: player.primaryPositionId,
              nflTeam: player.nflTeam,
            })}
          </div>
        </div>
      </div>

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
    player.scoringBreakdown != null &&
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
          {formatPts(actual, 1)}
        </button>
      ) : (
        <span className="text-sm font-semibold leading-none">
          {formatPts(actual, 1)}
        </span>
      )}
      <span className="text-xs leading-none text-muted-foreground">
        {formatPts(projected)}
      </span>
    </div>
  );

  // Same gap as position pill ↔ check (parent uses gap-3 / sm:gap-4).
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

function DuelRow({
  row,
  onActualClick,
  showAdv,
}: {
  row: GameCentreDuelRow;
  onActualClick?: (player: GameCentrePlayer) => void;
  showAdv: boolean;
}) {
  return (
    <li className="flex min-w-[52rem] items-center justify-between border-b last:border-b-0 sm:min-w-[56rem]">
      <DuelPlayerCard player={row.away} align="away" />

      <div className="flex shrink-0 items-center gap-3 px-3 sm:gap-4 sm:px-4">
        <ScoreCluster
          player={row.away}
          align="away"
          hasAdv={showAdv && row.adv === "away"}
          showAdv={showAdv}
          onActualClick={onActualClick}
        />
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-background text-[11px] font-semibold text-muted-foreground">
          {row.slotPositionId}
        </span>
        <ScoreCluster
          player={row.home}
          align="home"
          hasAdv={showAdv && row.adv === "home"}
          showAdv={showAdv}
          onActualClick={onActualClick}
        />
      </div>

      <DuelPlayerCard player={row.home} align="home" />
    </li>
  );
}

type MatchupRosterListProps = {
  title: string;
  rows: GameCentreDuelRow[];
  onActualClick?: (player: GameCentrePlayer) => void;
  emptyMessage: string;
  /** ADV checkmarks — starters only. */
  showAdv?: boolean;
};

export function MatchupRosterList({
  title,
  rows,
  onActualClick,
  emptyMessage,
  showAdv = true,
}: MatchupRosterListProps) {
  if (rows.length === 0) {
    return (
      <TableShell>
        <div className="flex h-10 items-center border-b bg-muted px-4 text-xs font-medium uppercase">
          {title}
        </div>
        <p className="px-4 py-3 text-sm text-pretty text-muted-foreground">
          {emptyMessage}
        </p>
      </TableShell>
    );
  }

  return (
    <TableShell>
      <div className="flex h-10 items-center border-b bg-muted px-4 text-xs font-medium uppercase">
        {title}
      </div>
      <ul className="overflow-x-auto">
        {rows.map((row, index) => (
          <DuelRow
            key={`${title}-${row.slotPositionId}-${index}`}
            row={row}
            onActualClick={onActualClick}
            showAdv={showAdv}
          />
        ))}
      </ul>
    </TableShell>
  );
}

export function StarterDuelList({
  rows,
  onActualClick,
}: {
  rows: GameCentreDuelRow[];
  onActualClick?: (player: GameCentrePlayer) => void;
}) {
  return (
    <MatchupRosterList
      title="Starters"
      rows={rows}
      onActualClick={onActualClick}
      emptyMessage="No starters set for this matchup."
    />
  );
}
