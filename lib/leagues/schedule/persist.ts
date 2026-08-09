import { eq } from "drizzle-orm";

import { matchups } from "@/db/schema";
import type { PlayEachOtherTimes, ScheduleSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import { allocateMatchupPublicIds } from "@/lib/leagues/ensure-public-ids";
import {
  generateRegularSeasonSchedule,
  type GeneratedMatchup,
} from "@/lib/leagues/schedule/generate";
import { fantasyRegularSeasonEndWeek } from "@/lib/leagues/schedule/fantasy-week-map";
import {
  clampPlayEachOtherTimes,
  resolveScheduleSettings,
} from "@/lib/leagues/schedule/settings";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function replaceSeasonMatchups(
  executor: Tx | typeof db,
  input: {
    leagueSeasonId: string;
    teamIds: string[];
    weekCount: number;
    playEachOtherTimes: PlayEachOtherTimes;
  },
): Promise<GeneratedMatchup[]> {
  const generated = generateRegularSeasonSchedule({
    teamIds: input.teamIds,
    weekCount: input.weekCount,
    playEachOtherTimes: input.playEachOtherTimes,
  });

  // Regen is only allowed before the fantasy season starts — wipe the whole
  // season so shortening the regular season cannot leave orphan weeks behind.
  await executor
    .delete(matchups)
    .where(eq(matchups.leagueSeasonId, input.leagueSeasonId));

  if (generated.length > 0) {
    const publicIds = await allocateMatchupPublicIds(
      input.leagueSeasonId,
      generated.length,
      executor,
    );
    await executor.insert(matchups).values(
      generated.map((row, index) => ({
        leagueSeasonId: input.leagueSeasonId,
        publicId: publicIds[index]!,
        week: row.week,
        homeTeamId: row.homeTeamId,
        awayTeamId: row.awayTeamId,
      })),
    );
  }

  return generated;
}

/** Generate/replace the schedule when the league roster is full. */
export async function generateScheduleIfLeagueFull(input: {
  leagueSeasonId: string;
  teamCount: number;
  divisionCount: number;
  regularSeasonEndWeek: number;
  teamIds: string[];
  scheduleSettings?: ScheduleSettings | null;
  /** @deprecated Prefer scheduleSettings */
  storedPlayEachOtherTimes?: PlayEachOtherTimes | null;
}): Promise<{ generated: boolean; matchupCount: number }> {
  if (input.teamIds.length !== input.teamCount || input.teamCount < 2) {
    return { generated: false, matchupCount: 0 };
  }

  const schedule = resolveScheduleSettings(
    input.scheduleSettings ??
      (input.storedPlayEachOtherTimes != null
        ? { playEachOtherTimes: input.storedPlayEachOtherTimes }
        : null),
  );
  const times = clampPlayEachOtherTimes(
    schedule.playEachOtherTimes,
    input.divisionCount,
  );
  const weekCount = fantasyRegularSeasonEndWeek(
    input.regularSeasonEndWeek,
    schedule,
  );

  const generated = await replaceSeasonMatchups(db, {
    leagueSeasonId: input.leagueSeasonId,
    teamIds: input.teamIds,
    weekCount,
    playEachOtherTimes: times,
  });

  return { generated: true, matchupCount: generated.length };
}
