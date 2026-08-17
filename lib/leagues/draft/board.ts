import type {
  DraftStyle,
  RosterSlotConfig,
} from "@/db/schema/league-seasons";
import { getMaxRosterSize } from "@/lib/leagues/roster-capacity";

export type DraftTeamSlot = {
  id: string;
  name: string;
  draftSlot: number;
  logoUrl?: string | null;
};

export type DraftScheduleSlot = {
  overall: number;
  round: number;
  pickInRound: number;
  teamId: string;
  teamName: string;
  /** True when snake even rounds run right-to-left. */
  serpentine: boolean;
};

/** How many picks each team makes (starters + bench; IR/taxi excluded). */
export function getDraftRounds(
  rosterSlots: RosterSlotConfig[] | null | undefined,
  benchSlots: number,
) {
  return getMaxRosterSize(rosterSlots, benchSlots);
}

/** Ordered team list by draftSlot ascending. */
export function teamsByDraftSlot(teams: DraftTeamSlot[]) {
  return [...teams].sort((a, b) => a.draftSlot - b.draftSlot);
}

/**
 * Full pick schedule for a snake or linear draft.
 * `rounds` = picks per team.
 */
export function buildDraftSchedule(input: {
  teams: DraftTeamSlot[];
  rounds: number;
  style: DraftStyle;
}): DraftScheduleSlot[] {
  const ordered = teamsByDraftSlot(input.teams);
  if (ordered.length === 0 || input.rounds <= 0) {
    return [];
  }

  const schedule: DraftScheduleSlot[] = [];
  let overall = 1;

  for (let round = 1; round <= input.rounds; round++) {
    const snakeReverse =
      input.style === "snake" && round % 2 === 0;
    const roundTeams = snakeReverse ? [...ordered].reverse() : ordered;

    for (let i = 0; i < roundTeams.length; i++) {
      const team = roundTeams[i]!;
      schedule.push({
        overall,
        round,
        pickInRound: i + 1,
        teamId: team.id,
        teamName: team.name,
        serpentine: snakeReverse,
      });
      overall += 1;
    }
  }

  return schedule;
}

/** Picks from the current slot until `teamId` is on the clock (0 = now). */
export function getPicksUntilTeam(
  schedule: readonly DraftScheduleSlot[],
  currentPickIndex: number,
  teamId: string | null | undefined,
): number | null {
  return getRemainingTeamPickSlots(schedule, currentPickIndex, teamId)[0]
    ?.picksUntil ?? null;
}

/** Every remaining slot for `teamId` from the current pick onward. */
export function getRemainingTeamPickSlots(
  schedule: readonly DraftScheduleSlot[],
  currentPickIndex: number,
  teamId: string | null | undefined,
): { picksUntil: number; slot: DraftScheduleSlot }[] {
  if (!teamId) {
    return [];
  }

  const slots: { picksUntil: number; slot: DraftScheduleSlot }[] = [];
  for (let index = currentPickIndex; index < schedule.length; index++) {
    const slot = schedule[index];
    if (slot?.teamId === teamId) {
      slots.push({ picksUntil: index - currentPickIndex, slot });
    }
  }
  return slots;
}

export function getNextTeamPickSlot(
  schedule: readonly DraftScheduleSlot[],
  currentPickIndex: number,
  teamId: string | null | undefined,
): { picksUntil: number; slot: DraftScheduleSlot } | null {
  return getRemainingTeamPickSlots(schedule, currentPickIndex, teamId)[0] ?? null;
}
