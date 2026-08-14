import type { ScheduleSettings } from "@/db/schema/league-seasons";
import type { PlayerScoreNflState } from "@/lib/leagues/schedule/player-score-point";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import {
  overlayTeamPlayerStatRows,
  resolveTeamPlayerStatsSource,
} from "@/lib/leagues/team-stats";
import {
  getRankedPlayers,
  type RankedPlayerRow,
} from "@/lib/queries/players";

/** Roster Player Stats: same RANK source as League Players Stats. */
export async function getTeamRosterStatPlayers(input: {
  season: string;
  playerIds: string[];
  scoringRules: ScoringRuleDefinition[];
  nfl: PlayerScoreNflState;
  schedule?: ScheduleSettings | null;
}): Promise<RankedPlayerRow[]> {
  if (input.playerIds.length === 0) {
    return [];
  }

  const source = resolveTeamPlayerStatsSource({
    nfl: input.nfl,
    schedule: input.schedule,
    seasonYear: Number(input.season),
  });

  const rankedPromise = getRankedPlayers({
    season: input.season,
    week: source.week,
    seasonType: source.seasonType,
    kind: source.kind,
    scoringRules: input.scoringRules,
    playerIds: input.playerIds,
    includePositionRanks: true,
    positionRanks: source.positionRanks,
  });

  if (source.kind === "projection") {
    return rankedPromise;
  }

  const [actuals, universe] = await Promise.all([
    rankedPromise,
    getRankedPlayers({
      season: input.season,
      week: 0,
      seasonType: "regular",
      kind: "projection",
      scoringRules: input.scoringRules,
      playerIds: input.playerIds,
      includePositionRanks: true,
      positionRanks: source.positionRanks,
    }),
  ]);

  return overlayTeamPlayerStatRows(universe, actuals);
}
