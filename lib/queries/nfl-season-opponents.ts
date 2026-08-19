import {
  getNflTeamSchedule,
  type NflTeamScheduleWeek,
} from "@/lib/espn/team-schedule";
import { createProcessCache } from "@/lib/cache/process-cache";
import { NFL_TEAMS } from "@/lib/nfl/teams";
import { parseOpponentMeta } from "@/lib/players/overview-metrics";

function buildOpponentByTeamWeek(
  schedules: Array<{ team: string; weeks: NflTeamScheduleWeek[] }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const { team, weeks } of schedules) {
    for (const week of weeks) {
      const meta = parseOpponentMeta(week.opponent);
      if (meta.isBye || !meta.abbrev) continue;
      map.set(`${team}|${week.week}`, meta.abbrev);
    }
  }
  return map;
}

async function loadNflSeasonOpponentEntries(
  season: string,
): Promise<Array<[string, string]>> {
  const scheduleResults = await Promise.all(
    NFL_TEAMS.map(async (team) => ({
      team,
      weeks: await getNflTeamSchedule({
        nflTeam: team,
        season,
      }),
    })),
  );
  return [...buildOpponentByTeamWeek(scheduleResults).entries()];
}

const getCachedNflSeasonOpponentEntries = createProcessCache<
  Array<[string, string]>
>({
  ttlMs: 60 * 60 * 1000,
  maxEntries: 8,
});

/** Opponent NFL team abbrev by `{team}|{week}` for a full regular season. */
export async function getNflSeasonOpponentByTeamWeek(
  season: string,
): Promise<Map<string, string>> {
  const entries = await getCachedNflSeasonOpponentEntries(season, () =>
    loadNflSeasonOpponentEntries(season),
  );
  return new Map(entries);
}
