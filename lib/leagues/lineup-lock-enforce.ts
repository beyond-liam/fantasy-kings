import type { LineupLockMode } from "@/db/schema/league-seasons";
import { hasNflTeamStarted } from "@/lib/leagues/waivers/game-lock";

const RESERVE_SLOTS = new Set(["BN", "IR", "TAXI"]);

export function isStarterSlot(slotPositionId: string | null | undefined) {
  if (!slotPositionId) return false;
  return !RESERVE_SLOTS.has(slotPositionId);
}

/**
 * Whether a proposed slot change is blocked by lineup lock settings.
 * - first_game: any move involving a starter slot locks once any NFL game started
 * - individual: moves involving a player whose NFL game has started are locked
 */
export function isLineupEditBlocked(input: {
  mode: LineupLockMode;
  previousSlot: string | null | undefined;
  nextSlot: string | null | undefined;
  playerNflTeam: string | null | undefined;
  startedTeams: Set<string>;
}): boolean {
  const previousIsStarter = isStarterSlot(input.previousSlot);
  const nextIsStarter = isStarterSlot(input.nextSlot);
  const touchesStarter = previousIsStarter || nextIsStarter;

  if (!touchesStarter) {
    return false;
  }

  if (input.mode === "first_game") {
    return input.startedTeams.size > 0;
  }

  return hasNflTeamStarted(input.playerNflTeam, input.startedTeams);
}

export function findBlockedLineupMoves(input: {
  mode: LineupLockMode;
  startedTeams: Set<string>;
  changes: Array<{
    fullName: string;
    nflTeam: string | null;
    previousSlot: string | null;
    nextSlot: string | null;
  }>;
}): string | null {
  for (const change of input.changes) {
    if (
      change.previousSlot === change.nextSlot ||
      (change.previousSlot == null && change.nextSlot == null)
    ) {
      continue;
    }
    if (
      isLineupEditBlocked({
        mode: input.mode,
        previousSlot: change.previousSlot,
        nextSlot: change.nextSlot,
        playerNflTeam: change.nflTeam,
        startedTeams: input.startedTeams,
      })
    ) {
      return input.mode === "first_game"
        ? `Lineups are locked — the first NFL game of the week has started (${change.fullName}).`
        : `${change.fullName}'s lineup slot is locked — their NFL game has started.`;
    }
  }
  return null;
}
