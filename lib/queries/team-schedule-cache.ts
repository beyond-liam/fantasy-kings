import "server-only";

import { createProcessCache } from "@/lib/cache/process-cache";
import type { TeamScheduleRow } from "@/lib/queries/matchups";

const getCachedTeamScheduleRows = createProcessCache<TeamScheduleRow[]>({
  ttlMs: 5 * 60 * 1000,
  maxEntries: 128,
});

export async function getCachedTeamSchedule(
  leagueSeasonId: string,
  teamId: string,
  loader: () => Promise<TeamScheduleRow[]>,
): Promise<TeamScheduleRow[]> {
  return getCachedTeamScheduleRows(`${leagueSeasonId}:${teamId}`, loader);
}
