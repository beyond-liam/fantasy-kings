import "server-only";

import type { TeamRosterPlayer } from "@/lib/leagues/roster-fill";
import { rosterSlotsFingerprint } from "@/lib/leagues/roster-slots-fingerprint";
import { getTeamRosterPlayers } from "@/lib/queries/team-roster";

type RosterCacheEntry = {
  fingerprint: string;
  players: TeamRosterPlayer[];
  loadedAt: number;
};

const ROSTER_DISPLAY_TTL_MS = 5 * 60 * 1000;
const store = new Map<string, RosterCacheEntry>();

export function seedTeamRosterDisplayCache(
  teamId: string,
  players: TeamRosterPlayer[],
) {
  store.set(teamId, {
    fingerprint: rosterSlotsFingerprint(players),
    players,
    loadedAt: Date.now(),
  });
}

export function invalidateTeamRosterDisplayCache(teamId?: string) {
  if (teamId) {
    store.delete(teamId);
    return;
  }
  store.clear();
}

/** Resolve roster for week-switch API; skips DB when client fingerprint matches cache. */
export async function resolveTeamRosterForWeekDisplay(
  teamId: string,
  clientFingerprint?: string | null,
): Promise<TeamRosterPlayer[]> {
  const hit = store.get(teamId);
  const fresh = hit != null && Date.now() - hit.loadedAt < ROSTER_DISPLAY_TTL_MS;

  if (fresh) {
    if (!clientFingerprint || hit.fingerprint === clientFingerprint) {
      return hit.players;
    }
  }

  const players = await getTeamRosterPlayers(teamId);
  seedTeamRosterDisplayCache(teamId, players);
  return players;
}
