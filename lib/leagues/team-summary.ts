import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { formatLeaderPositionLabel } from "@/lib/leagues/league-position-stats";
import {
  countActivePositionPlayers,
  countActiveRosterPlayers,
  getMaxRosterSize,
  getPositionRosterMax,
} from "@/lib/leagues/roster-capacity";
import { getIrLockViolations } from "@/lib/leagues/ir-lock";
import { getTaxiLockViolations } from "@/lib/leagues/taxi-lock";
import { resolveTaxiMaxYearsExp } from "@/lib/leagues/taxi-eligibility";
import { ROSTER_POSITION_ORDER } from "@/lib/leagues/roster-position-order";

export type TeamSummaryPlayer = {
  id: string;
  fullName: string;
  primaryPositionId: string;
  injuryStatus: string | null;
  yearsExp?: number | null;
  slotPositionId: string | null;
};

export type TeamSummaryPositionRow = {
  positionId: string;
  label: string;
  count: number;
  min: number;
  max: number;
  /** Below the configured position minimum (minSlots). */
  illegal: boolean;
};

export type TeamSummaryReserveRow = {
  kind: "ir" | "taxi";
  label: string;
  count: number;
  max: number;
  illegal: boolean;
  illegalCount: number;
};

export type TeamSummaryRosterBreakdown = {
  positions: TeamSummaryPositionRow[];
  starters: { count: number; max: number };
  active: { count: number; max: number };
  ir: TeamSummaryReserveRow | null;
  taxi: TeamSummaryReserveRow | null;
};

export type TeamSummaryScheduleRow = {
  week: number;
  publicId: string;
  opponentName: string;
  opponentSlug: string;
  isHome: boolean;
  status: "scheduled" | "in_progress" | "final";
  /** Focus team's points when final; otherwise null. */
  teamPts: number | null;
  opponentPts: number | null;
};

export type TeamSummaryMatchupRef = {
  week: number;
  publicId: string;
  opponentName: string;
  opponentSlug: string;
  isHome: boolean;
  result: "win" | "loss" | "tie" | null;
};

function slotMin(slot: RosterSlotConfig) {
  const value = Number(slot.minSlots ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function slotCount(slot: RosterSlotConfig) {
  const value = Number(slot.slotCount);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function getPositionMin(
  rosterSlots: RosterSlotConfig[],
  positionId: string,
) {
  return rosterSlots
    .filter((slot) => slot.positionId === positionId)
    .reduce((sum, slot) => sum + slotMin(slot), 0);
}

function getStarterMax(
  rosterSlots: RosterSlotConfig[],
) {
  return rosterSlots
    .filter(
      (slot) =>
        slot.isStarter &&
        slot.positionId !== "BN" &&
        slot.positionId !== "IR" &&
        slot.positionId !== "TAXI",
    )
    .reduce((sum, slot) => sum + slotCount(slot), 0);
}

function starterPositionIds(rosterSlots: RosterSlotConfig[]) {
  const ids = new Set(
    rosterSlots
      .filter(
        (slot) =>
          slot.isStarter &&
          slot.slotCount > 0 &&
          slot.positionId !== "BN" &&
          slot.positionId !== "IR" &&
          slot.positionId !== "TAXI" &&
          slot.positionId !== "FLEX",
      )
      .map((slot) => slot.positionId),
  );

  const ordered = ROSTER_POSITION_ORDER.filter((id) => ids.has(id));
  const extras = [...ids]
    .filter((id) => !ROSTER_POSITION_ORDER.includes(id as (typeof ROSTER_POSITION_ORDER)[number]))
    .sort((a, b) => a.localeCompare(b));
  return [...ordered, ...extras];
}

function countStarters(players: TeamSummaryPlayer[], rosterSlots: RosterSlotConfig[]) {
  const starterIds = new Set(
    rosterSlots
      .filter((slot) => slot.isStarter)
      .map((slot) => slot.positionId)
      .filter((id) => id !== "BN" && id !== "IR" && id !== "TAXI"),
  );

  return players.filter((player) => {
    const slot = player.slotPositionId;
    return slot != null && starterIds.has(slot);
  }).length;
}

function countInSlot(players: TeamSummaryPlayer[], slotPositionId: string) {
  return players.filter((player) => player.slotPositionId === slotPositionId)
    .length;
}

export function buildTeamSummaryRosterBreakdown(input: {
  players: TeamSummaryPlayer[];
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  irEligibleStatuses?: readonly string[] | null;
  taxiEnabled: boolean;
  taxiSlots: number;
  taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
}): TeamSummaryRosterBreakdown {
  const {
    players,
    rosterSlots,
    benchSlots,
    irEnabled,
    irSlots,
    irEligibleStatuses,
    taxiEnabled,
    taxiSlots,
    taxiMaxYearsExp,
  } = input;

  const positions = starterPositionIds(rosterSlots).map((positionId) => {
    const max = getPositionRosterMax(rosterSlots, positionId);
    const min = getPositionMin(rosterSlots, positionId);
    const count = countActivePositionPlayers(players, positionId);
    return {
      positionId,
      label: formatLeaderPositionLabel(positionId),
      count,
      min,
      max: Number.isFinite(max) ? max : min,
      illegal: min > 0 && count < min,
    };
  });

  const startersMax = getStarterMax(rosterSlots);
  const activeMax = getMaxRosterSize(rosterSlots, benchSlots);

  const irMax =
    irEnabled
      ? rosterSlots
          .filter((slot) => slot.positionId === "IR")
          .reduce((sum, slot) => sum + slotCount(slot), 0) || irSlots
      : 0;
  const taxiMax =
    taxiEnabled
      ? rosterSlots
          .filter((slot) => slot.positionId === "TAXI")
          .reduce((sum, slot) => sum + slotCount(slot), 0) || taxiSlots
      : 0;

  const irViolations = irEnabled
    ? getIrLockViolations(players, irEligibleStatuses)
    : [];
  const taxiViolations = taxiEnabled
    ? getTaxiLockViolations(
        players,
        resolveTaxiMaxYearsExp(taxiMaxYearsExp),
      )
    : [];
  const irCount = countInSlot(players, "IR");
  const taxiCount = countInSlot(players, "TAXI");

  return {
    positions,
    starters: {
      count: countStarters(players, rosterSlots),
      max: startersMax,
    },
    active: {
      count: countActiveRosterPlayers(players),
      max: activeMax,
    },
    ir: irEnabled
      ? {
          kind: "ir",
          label: "IR",
          count: irCount,
          max: irMax,
          illegal: irViolations.length > 0,
          illegalCount: irViolations.length,
        }
      : null,
    taxi: taxiEnabled
      ? {
          kind: "taxi",
          label: "Taxi",
          count: taxiCount,
          max: taxiMax,
          illegal:
            taxiViolations.length > 0 || taxiCount > taxiMax,
          illegalCount: Math.max(
            taxiViolations.length,
            Math.max(0, taxiCount - taxiMax),
          ),
        }
      : null,
  };
}

export function formatWaiverPriority(priority: number | null | undefined) {
  if (priority == null || !Number.isFinite(priority) || priority < 1) {
    return null;
  }
  const n = Math.trunc(priority);
  const mod100 = n % 100;
  const mod10 = n % 10;
  let suffix = "th";
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suffix = "st";
    else if (mod10 === 2) suffix = "nd";
    else if (mod10 === 3) suffix = "rd";
  }
  return `${n}${suffix}`;
}

function matchupResult(
  teamPts: number | null,
  opponentPts: number | null,
  status: TeamSummaryScheduleRow["status"],
): "win" | "loss" | "tie" | null {
  if (status !== "final" || teamPts == null || opponentPts == null) {
    return null;
  }
  if (teamPts > opponentPts) return "win";
  if (teamPts < opponentPts) return "loss";
  return "tie";
}

function toMatchupRef(row: TeamSummaryScheduleRow): TeamSummaryMatchupRef {
  return {
    week: row.week,
    publicId: row.publicId,
    opponentName: row.opponentName,
    opponentSlug: row.opponentSlug,
    isHome: row.isHome,
    result: matchupResult(row.teamPts, row.opponentPts, row.status),
  };
}

/** Previous = latest final before current week; Current = this week or next upcoming. */
export function resolveTeamSummaryMatchups(
  schedule: TeamSummaryScheduleRow[],
  currentWeek: number,
): {
  previous: TeamSummaryMatchupRef | null;
  current: TeamSummaryMatchupRef | null;
} {
  const sorted = [...schedule].sort((a, b) => a.week - b.week);

  const previous =
    [...sorted]
      .reverse()
      .find(
        (row) =>
          row.status === "final" &&
          row.week < currentWeek &&
          row.teamPts != null &&
          row.opponentPts != null,
      ) ??
    [...sorted]
      .reverse()
      .find((row) => row.status === "final" && row.week < currentWeek) ??
    null;

  const thisWeek = sorted.find((row) => row.week === currentWeek) ?? null;
  const nextUpcoming =
    sorted.find(
      (row) =>
        row.week > currentWeek &&
        (row.status === "scheduled" || row.status === "in_progress"),
    ) ?? null;

  const current =
    thisWeek && thisWeek.status !== "final"
      ? thisWeek
      : thisWeek?.status === "final"
        ? nextUpcoming
        : (thisWeek ?? nextUpcoming);

  return {
    previous: previous ? toMatchupRef(previous) : null,
    current: current ? toMatchupRef(current) : null,
  };
}
