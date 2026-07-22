import { eq } from "drizzle-orm";

import { matchups } from "@/db/schema";
import { db } from "@/lib/db";
import { allocateMatchupPublicIds } from "@/lib/leagues/ensure-public-ids";
import {
  generateRegularSeasonSchedule,
  type GeneratedMatchup,
} from "@/lib/leagues/schedule/generate";
import {
  clampPlayEachOtherTimes,
  resolveScheduleSettings,
} from "@/lib/leagues/schedule/settings";
import type { PlayEachOtherTimes } from "@/db/schema/league-seasons";

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

  await executor
    .delete(matchups)
    .where(eq(matchups.leagueSeasonId, input.leagueSeasonId));

  if (generated.length > 0) {
    const publicIds = await allocateMatchupPublicIds(
      input.leagueSeasonId,
      generated.length,
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
  storedPlayEachOtherTimes?: PlayEachOtherTimes | null;
}): Promise<{ generated: boolean; matchupCount: number }> {
  if (input.teamIds.length !== input.teamCount || input.teamCount < 2) {
    return { generated: false, matchupCount: 0 };
  }

  const times = clampPlayEachOtherTimes(
    resolveScheduleSettings(
      input.storedPlayEachOtherTimes != null
        ? { playEachOtherTimes: input.storedPlayEachOtherTimes }
        : null,
    ).playEachOtherTimes,
    input.divisionCount,
  );

  const generated = await replaceSeasonMatchups(db, {
    leagueSeasonId: input.leagueSeasonId,
    teamIds: input.teamIds,
    weekCount: input.regularSeasonEndWeek,
    playEachOtherTimes: times,
  });

  return { generated: true, matchupCount: generated.length };
}
