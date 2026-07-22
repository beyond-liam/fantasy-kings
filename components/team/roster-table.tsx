"use client";

import {
  EmptyPlayerIdentity,
  PlayerIdentity,
} from "@/components/rankings/player-identity";
import { OpponentCell } from "@/components/team/opponent-cell";
import { PointsCell } from "@/components/team/points-cell";
import { RosterRowActions } from "@/components/team/roster-row-actions";
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
import { PLAYER_STAT_COLUMNS } from "@/lib/rankings/player-stat-columns";
import { cn } from "@/lib/utils";

type TeamRosterTableProps = {
  section: RosterTableSectionId;
  slots: FilledRosterSlot[];
  assignmentOptions: RosterAssignmentOption[];
  leagueSlug: string;
  actionsEnabled?: boolean;
  rowActionsEnabled?: boolean;
  actionsVariant?: "mine" | "opponent";
  partnerTeamSlug?: string;
  tradesEnabled?: boolean;
  irEligibleStatuses?: readonly string[];
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  rosterPlayers: TeamRosterPlayer[];
  onSlotChange?: (playerId: string, slotPositionId: string) => void;
};

const PLACEHOLDER = "—";

const COLUMNS = [
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
  rosterSlots,
  benchSlots,
  rosterPlayers,
  onSlotChange,
}: {
  slot: FilledRosterSlot;
  assignmentOptions: RosterAssignmentOption[];
  disabled: boolean;
  irEligibleStatuses?: readonly string[];
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
  actionsVariant = "mine",
  partnerTeamSlug,
  tradesEnabled = true,
  irEligibleStatuses,
  rosterSlots,
  benchSlots,
  rosterPlayers,
  onSlotChange,
}: TeamRosterTableProps) {
  if (slots.length === 0) {
    return null;
  }

  const showRowActions = rowActionsEnabled ?? actionsEnabled;
  const columns = showRowActions
    ? COLUMNS
    : COLUMNS.filter((column) => column.id !== "action");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{rosterSectionTitle(section)}</h2>
      <TableShell>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead
                    key={column.id}
                    className={cn(
                      column.id === "player" && "min-w-[12rem]",
                      column.id === "slot" && "w-[7.5rem]",
                      column.id === "action" && "w-10",
                    )}
                  >
                    <TeamTableColumnHeader
                      title={column.header}
                      tooltip={"tooltip" in column ? column.tooltip : undefined}
                      srOnly={"srOnly" in column ? column.srOnly : undefined}
                    />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slots.map((slot) => (
                <TableRow key={slot.key}>
                  <TableCell>
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
                      />
                    ) : (
                      <EmptyPlayerIdentity
                        slotLabel={defaultSlotLabel(slot.slotPositionId)}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <OpponentCell opponent={slot.player?.opponent} />
                  </TableCell>
                  <TableCell>
                    {slot.player ? (
                      <PointsCell
                        actualPts={slot.player.actualPts}
                        projectedPts={slot.player.projectedPts}
                        showActual={
                          slot.player.opponent?.gameStatus === "in" ||
                          slot.player.opponent?.gameStatus === "post"
                        }
                      />
                    ) : (
                      <span className="text-muted-foreground">{PLACEHOLDER}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {PLACEHOLDER}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {PLACEHOLDER}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {PLACEHOLDER}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {slot.player
                      ? formatRosterRatePct(slot.player.ownedPct)
                      : PLACEHOLDER}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {slot.player
                      ? formatRosterRatePct(slot.player.startPct)
                      : PLACEHOLDER}
                  </TableCell>
                  <TableCell>
                    <RosterSlotSelect
                      slot={slot}
                      assignmentOptions={assignmentOptions}
                      disabled={!actionsEnabled || !slot.player}
                      irEligibleStatuses={irEligibleStatuses}
                      rosterSlots={rosterSlots}
                      benchSlots={benchSlots}
                      rosterPlayers={rosterPlayers}
                      onSlotChange={onSlotChange}
                    />
                  </TableCell>
                  {showRowActions ? (
                    <TableCell>
                      <RosterRowActions
                        player={slot.player}
                        leagueSlug={leagueSlug}
                        disabled={!slot.player || !actionsEnabled}
                        variant={actionsVariant}
                        partnerTeamSlug={partnerTeamSlug}
                        tradesEnabled={tradesEnabled}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </TableShell>
    </section>
  );
}
