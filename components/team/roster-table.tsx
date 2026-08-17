"use client";

import type { CSSProperties } from "react";
import {
  EmptyPlayerIdentity,
  PlayerIdentity,
} from "@/components/rankings/player-identity";
import {
  PLAYER_COLUMN_WIDTH,
} from "@/components/rankings/sticky-player-columns";
import { OpponentCell } from "@/components/team/opponent-cell";
import { PointsCell } from "@/components/team/points-cell";
import { RosterRowActions } from "@/components/team/roster-row-actions";
import { RosterSlotSwap } from "@/components/team/roster-slot-swap";
import { TeamTableColumnHeader } from "@/components/team/team-table-column-header";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import {
  defaultSlotLabel,
  rosterSectionTitle,
  type RosterAssignmentOption,
  type RosterTableSectionId,
} from "@/lib/leagues/roster-display";
import { filterAssignmentOptionsForPlayer } from "@/lib/leagues/roster-slots";
import type {
  FilledRosterSlot,
  TeamRosterPlayer,
} from "@/lib/leagues/roster-fill";
import { formatRosterRatePct } from "@/lib/leagues/format-roster-rate";
import { formatStatValue } from "@/lib/rankings/column-config";
import { PLAYER_STAT_COLUMNS } from "@/lib/rankings/player-stat-columns";
import {
  formatPositionRank,
  getPositionRankColorClass,
} from "@/lib/rankings/stat-helpers";
import { cn } from "@/lib/utils";

type TeamRosterTableProps = {
  section: RosterTableSectionId;
  slots: FilledRosterSlot[];
  assignmentOptions: RosterAssignmentOption[];
  leagueSlug: string;
  actionsEnabled?: boolean;
  rowActionsEnabled?: boolean;
  cutActionsEnabled?: boolean;
  actionsVariant?: "mine" | "opponent";
  partnerTeamSlug?: string;
  tradesEnabled?: boolean;
  irEligibleStatuses?: readonly string[];
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  rosterPlayers: TeamRosterPlayer[];
  taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
  taxiPreventReaddAfterActivation?: boolean;
  gameLockedPlayerIds?: Set<string>;
  onSlotChange?: (playerId: string, slotPositionId: string) => void;
  onSwap?: (playerId: string, otherPlayerId: string) => void;
  onActualClick?: (player: TeamRosterPlayer) => void;
};

const PLACEHOLDER = "—";

/**
 * Only these cols get an explicit width. Other cols stay unset so they absorb
 * leftover table width — same pattern as DataTable `layout="fixed"` / stats.
 * (If every col has a width, `table-fixed` + `w-full` stretches Player too.)
 *
 * Mobile adds a separate sticky avatar col (`md:hidden`). Desktop keeps a single
 * 224px Player col. Name-only mobile width drops avatar sm + former gap-2.5.
 */
const FIXED_COL_PX = {
  /** Mobile only: pl-2 + badge + gap-2 + avatar sm + pr-2.5 */
  avatar: 86,
  player: PLAYER_COLUMN_WIDTH,
  opponent: 144, // fits live down/distance
  slot: 120, // 7.5rem select
  action: 48, // icon-sm (32) + cell px-2 (16)
} as const;

type FixedColId = keyof typeof FIXED_COL_PX;

function fixedColStyle(id: string): CSSProperties | undefined {
  if (id in FIXED_COL_PX) {
    const width = FIXED_COL_PX[id as FixedColId];
    return { width, minWidth: width, maxWidth: width };
  }
  return undefined;
}

/** Mobile sticky avatar — hidden on md+ so desktop layout is unchanged. */
const AVATAR_COL_CLASS = "overflow-hidden md:hidden";

const AVATAR_CELL_PAD = "py-2 pl-2 pr-2.5";
/** Name-only cell on mobile; desktop Player cell keeps default `p-2`. */
const PLAYER_NAME_MOBILE_PAD = "max-md:py-2 max-md:pl-0 max-md:pr-2";

const PLAYER_COL_WIDTH_CLASS =
  "w-[190px] min-w-[190px] max-w-[190px] md:w-[224px] md:min-w-[224px] md:max-w-[224px]";

const STICKY_AVATAR_CELL = cn(
  AVATAR_CELL_PAD,
  "sticky left-0 z-20 overflow-hidden shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]",
  "bg-background group-hover/tr:bg-[color-mix(in_oklab,var(--muted)_50%,var(--background))] group-data-[state=selected]/tr:bg-muted",
);

const STICKY_AVATAR_HEAD = cn(
  AVATAR_CELL_PAD,
  "sticky left-0 z-30 overflow-hidden shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]",
);

const COL_CLASS: Record<string, string> = {
  avatar: AVATAR_COL_CLASS,
  player: "overflow-hidden",
  opponent: "overflow-hidden",
  points: "",
  rank: "",
  fantasyPoints: "",
  average: "",
  owned: "",
  start: "",
  slot: "max-md:hidden",
  action: "",
};

const COLUMNS = [
  { id: "avatar", header: "Player", srOnly: true },
  { id: "player", header: "Player" },
  { id: "opponent", header: "Opp", tooltip: "Opponent" },
  {
    id: "points",
    header: "PTS",
    tooltip: "This week's points (projected underneath)",
  },
  {
    id: "rank",
    header: PLAYER_STAT_COLUMNS.rank.header,
    tooltip: PLAYER_STAT_COLUMNS.rank.tooltip,
  },
  {
    id: "fantasyPoints",
    header: PLAYER_STAT_COLUMNS.fpts.header,
    tooltip: PLAYER_STAT_COLUMNS.fpts.tooltip,
  },
  {
    id: "average",
    header: PLAYER_STAT_COLUMNS.avg.header,
    tooltip: PLAYER_STAT_COLUMNS.avg.tooltip,
  },
  { id: "owned", header: "OWN", tooltip: "% of leagues that own this player" },
  {
    id: "start",
    header: "START",
    tooltip: "% started when owned",
  },
  { id: "slot", header: "Slot" },
  { id: "action", header: "Action", srOnly: true },
] as const;

function RosterSlotSelect({
  slot,
  assignmentOptions,
  disabled,
  irEligibleStatuses,
  taxiMaxYearsExp,
  taxiPreventReaddAfterActivation,
  rosterSlots,
  benchSlots,
  rosterPlayers,
  onSlotChange,
}: {
  slot: FilledRosterSlot;
  assignmentOptions: RosterAssignmentOption[];
  disabled: boolean;
  irEligibleStatuses?: readonly string[];
  taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
  taxiPreventReaddAfterActivation?: boolean;
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  rosterPlayers: TeamRosterPlayer[];
  onSlotChange?: (playerId: string, slotPositionId: string) => void;
}) {
  const player = slot.player;
  const options = player
    ? filterAssignmentOptionsForPlayer(
        assignmentOptions,
        player.primaryPositionId,
        {
          injuryStatus: player.injuryStatus,
          irEligibleStatuses,
          yearsExp: player.yearsExp,
          taxiMaxYearsExp,
          taxiActivated: player.taxiActivated,
          taxiPreventReaddAfterActivation,
          currentSlotPositionId: player.slotPositionId,
          rosterSlots,
          benchSlots,
          rosterPlayers,
          playerId: player.id,
        },
      )
    : assignmentOptions;

  const value = player
    ? (player.slotPositionId ?? slot.slotPositionId)
    : slot.slotPositionId;

  const handleChange = (next: string | null) => {
    if (!player || !next || next === value || disabled || !onSlotChange) {
      return;
    }
    onSlotChange(player.id, next);
  };

  return (
    <Select
      items={options}
      value={value}
      onValueChange={handleChange}
      disabled={disabled || !player}
    >
      <SelectTrigger
        size="sm"
        className="w-full"
        aria-label={
          player
            ? `Slot for ${player.fullName}`
            : `Empty ${defaultSlotLabel(slot.slotPositionId)} slot`
        }
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function TeamRosterTable({
  section,
  slots,
  assignmentOptions,
  leagueSlug,
  actionsEnabled = false,
  rowActionsEnabled,
  cutActionsEnabled,
  actionsVariant = "mine",
  partnerTeamSlug,
  tradesEnabled = true,
  irEligibleStatuses,
  rosterSlots,
  benchSlots,
  rosterPlayers,
  taxiMaxYearsExp,
  taxiPreventReaddAfterActivation,
  gameLockedPlayerIds,
  onSlotChange,
  onSwap,
  onActualClick,
}: TeamRosterTableProps) {
  if (slots.length === 0) {
    return null;
  }

  const showRowActions = rowActionsEnabled ?? actionsEnabled;
  const canCut = cutActionsEnabled ?? actionsEnabled;
  const lockedIds = gameLockedPlayerIds ?? new Set<string>();
  const columns = showRowActions
    ? COLUMNS
    : COLUMNS.filter((column) => column.id !== "action");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{rosterSectionTitle(section)}</h2>
      <TableShell>
        <TooltipProvider>
          <Table className="table-fixed min-w-4xl">
            <colgroup>
              {columns.map((column) => {
                const width =
                  column.id === "player" || !(column.id in FIXED_COL_PX)
                    ? undefined
                    : FIXED_COL_PX[column.id as FixedColId];
                return (
                  <col
                    key={column.id}
                    className={cn(
                      column.id === "avatar" && "md:hidden",
                      column.id === "slot" && "max-md:hidden",
                      column.id === "player" && PLAYER_COL_WIDTH_CLASS,
                    )}
                    style={width != null ? { width } : undefined}
                  />
                );
              })}
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead
                    key={column.id}
                    className={cn(
                      COL_CLASS[column.id],
                      column.id === "avatar" && STICKY_AVATAR_HEAD,
                      column.id === "player" &&
                        cn(PLAYER_NAME_MOBILE_PAD, PLAYER_COL_WIDTH_CLASS),
                    )}
                    style={
                      column.id === "avatar"
                        ? {
                            width: FIXED_COL_PX.avatar,
                            minWidth: FIXED_COL_PX.avatar,
                            maxWidth: FIXED_COL_PX.avatar,
                          }
                        : column.id === "player"
                          ? undefined
                          : fixedColStyle(column.id)
                    }
                  >
                    <TeamTableColumnHeader
                      title={column.header}
                      tooltip={
                        "tooltip" in column ? column.tooltip : undefined
                      }
                      srOnly={"srOnly" in column ? column.srOnly : undefined}
                    />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slots.map((slot) => {
                const player = slot.player;
                const playerLocked = Boolean(
                  player && lockedIds.has(player.id),
                );
                const swapProps = {
                  slotPositionId: slot.slotPositionId,
                  player: slot.player,
                  rosterPlayers,
                  rosterSlots,
                  irEligibleStatuses,
                  taxiMaxYearsExp,
                  taxiPreventReaddAfterActivation,
                  onSlotChange,
                  onSwap,
                  disabled: !actionsEnabled || playerLocked,
                } as const;
                return (
                <TableRow key={slot.key}>
                  <TableCell
                    className={cn(COL_CLASS.avatar, STICKY_AVATAR_CELL)}
                    style={{
                      width: FIXED_COL_PX.avatar,
                      minWidth: FIXED_COL_PX.avatar,
                      maxWidth: FIXED_COL_PX.avatar,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <RosterSlotSwap {...swapProps} />
                      {slot.player ? (
                        <PlayerIdentity
                          fullName={slot.player.fullName}
                          sleeperId={slot.player.sleeperId}
                          primaryPositionId={slot.player.primaryPositionId}
                          nflTeam={slot.player.nflTeam}
                          byeWeek={slot.player.byeWeek}
                          injuryStatus={slot.player.injuryStatus}
                          playerId={slot.player.id}
                          leagueSlug={leagueSlug}
                          showText={false}
                          hasPossession={slot.player.opponent?.hasPossession}
                          inRedZone={slot.player.opponent?.inRedZone}
                          isLive={slot.player.opponent?.gameStatus === "in"}
                        />
                      ) : (
                        <EmptyPlayerIdentity
                          slotLabel={defaultSlotLabel(slot.slotPositionId)}
                          showText={false}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    className={cn(
                      COL_CLASS.player,
                      PLAYER_NAME_MOBILE_PAD,
                      PLAYER_COL_WIDTH_CLASS,
                    )}
                  >
                    {/* Desktop: original combined identity (avatar col is md:hidden). */}
                    <div className="hidden min-w-0 items-center gap-2 md:flex">
                      {slot.player ? (
                        <PlayerIdentity
                          fullName={slot.player.fullName}
                          sleeperId={slot.player.sleeperId}
                          primaryPositionId={slot.player.primaryPositionId}
                          nflTeam={slot.player.nflTeam}
                          byeWeek={slot.player.byeWeek}
                          injuryStatus={slot.player.injuryStatus}
                          playerId={slot.player.id}
                          leagueSlug={leagueSlug}
                          className="min-w-0 flex-1"
                          hasPossession={slot.player.opponent?.hasPossession}
                          inRedZone={slot.player.opponent?.inRedZone}
                          isLive={slot.player.opponent?.gameStatus === "in"}
                        />
                      ) : (
                        <EmptyPlayerIdentity
                          slotLabel={defaultSlotLabel(slot.slotPositionId)}
                        />
                      )}
                    </div>
                    {/* Mobile: name scrolls; avatar sticks in the prior col. */}
                    <div className="md:hidden">
                      {slot.player ? (
                        <PlayerIdentity
                          fullName={slot.player.fullName}
                          sleeperId={slot.player.sleeperId}
                          primaryPositionId={slot.player.primaryPositionId}
                          nflTeam={slot.player.nflTeam}
                          byeWeek={slot.player.byeWeek}
                          injuryStatus={slot.player.injuryStatus}
                          playerId={slot.player.id}
                          leagueSlug={leagueSlug}
                          showAvatar={false}
                          className="min-w-0"
                        />
                      ) : (
                        <EmptyPlayerIdentity
                          slotLabel={defaultSlotLabel(slot.slotPositionId)}
                          showAvatar={false}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    className={COL_CLASS.opponent}
                    style={fixedColStyle("opponent")}
                  >
                    <OpponentCell opponent={slot.player?.opponent} />
                  </TableCell>
                  <TableCell className={COL_CLASS.points}>
                    {slot.player ? (
                      <PointsCell
                        actualPts={slot.player.actualPts}
                        projectedPts={slot.player.projectedPts}
                        showActual={
                          slot.player.opponent?.gameStatus === "in" ||
                          slot.player.opponent?.gameStatus === "post"
                        }
                        onActualClick={
                          onActualClick && player
                            ? () => onActualClick(player)
                            : undefined
                        }
                      />
                    ) : (
                      <span className="text-muted-foreground">
                        {PLACEHOLDER}
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      COL_CLASS.rank,
                      "font-medium tabular-nums",
                      getPositionRankColorClass(slot.player?.positionRank),
                    )}
                  >
                    {slot.player
                      ? formatPositionRank(
                          slot.player.primaryPositionId,
                          slot.player.positionRank,
                        )
                      : PLACEHOLDER}
                  </TableCell>
                  <TableCell
                    className={cn(COL_CLASS.fantasyPoints, "tabular-nums")}
                  >
                    {slot.player
                      ? formatStatValue(slot.player.fantasyPts, 2)
                      : PLACEHOLDER}
                  </TableCell>
                  <TableCell
                    className={cn(COL_CLASS.average, "tabular-nums")}
                  >
                    {slot.player
                      ? formatStatValue(slot.player.avgPts, 2)
                      : PLACEHOLDER}
                  </TableCell>
                  <TableCell
                    className={cn(COL_CLASS.owned, "tabular-nums")}
                  >
                    {slot.player
                      ? formatRosterRatePct(slot.player.ownedPct)
                      : PLACEHOLDER}
                  </TableCell>
                  <TableCell
                    className={cn(COL_CLASS.start, "tabular-nums")}
                  >
                    {slot.player
                      ? formatRosterRatePct(slot.player.startPct)
                      : PLACEHOLDER}
                  </TableCell>
                  <TableCell
                    className={COL_CLASS.slot}
                    style={fixedColStyle("slot")}
                  >
                    <RosterSlotSelect
                      slot={slot}
                      assignmentOptions={assignmentOptions}
                      disabled={
                        !actionsEnabled || !slot.player || playerLocked
                      }
                      irEligibleStatuses={irEligibleStatuses}
                      taxiMaxYearsExp={taxiMaxYearsExp}
                      taxiPreventReaddAfterActivation={
                        taxiPreventReaddAfterActivation
                      }
                      rosterSlots={rosterSlots}
                      benchSlots={benchSlots}
                      rosterPlayers={rosterPlayers}
                      onSlotChange={onSlotChange}
                    />
                  </TableCell>
                  {showRowActions ? (
                    <TableCell
                      className={COL_CLASS.action}
                      style={fixedColStyle("action")}
                    >
                      <RosterRowActions
                        player={slot.player}
                        leagueSlug={leagueSlug}
                        disabled={!slot.player || !canCut || playerLocked}
                        variant={actionsVariant}
                        partnerTeamSlug={partnerTeamSlug}
                        tradesEnabled={tradesEnabled}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
      </TableShell>
    </section>
  );
}
