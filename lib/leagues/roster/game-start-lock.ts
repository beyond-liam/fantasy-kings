import { hasNflTeamStarted } from "@/lib/leagues/waivers/game-lock";

export function gameStartCutBlockedMessage(fullName: string) {
  return `${fullName} can't be cut — their NFL game has started. Available again next fantasy week.`;
}

export function gameStartSlotBlockedMessage(fullName: string) {
  return `${fullName}'s slot is locked — their NFL game has started. Available again next fantasy week.`;
}

/** Block cut when prevent-cuts-after-game-start is on and the player's game has started. */
export function findBlockedGameStartCut(input: {
  preventCutsAfterGameStart: boolean;
  startedTeams: Set<string>;
  fullName: string;
  nflTeam: string | null;
}): string | null {
  if (!input.preventCutsAfterGameStart) return null;
  if (!hasNflTeamStarted(input.nflTeam, input.startedTeams)) return null;
  return gameStartCutBlockedMessage(input.fullName);
}

/** Block any slot change for a player whose NFL game has started. */
export function findBlockedGameStartMoves(input: {
  preventCutsAfterGameStart: boolean;
  startedTeams: Set<string>;
  changes: Array<{
    fullName: string;
    nflTeam: string | null;
    previousSlot: string | null;
    nextSlot: string | null;
  }>;
}): string | null {
  if (!input.preventCutsAfterGameStart) return null;

  for (const change of input.changes) {
    if (
      change.previousSlot === change.nextSlot ||
      (change.previousSlot == null && change.nextSlot == null)
    ) {
      continue;
    }
    if (hasNflTeamStarted(change.nflTeam, input.startedTeams)) {
      return gameStartSlotBlockedMessage(change.fullName);
    }
  }
  return null;
}
