import "server-only";

import { eq } from "drizzle-orm";

import { draftGrades, leagueSeasons } from "@/db/schema";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import { computeDraftGrades } from "@/lib/leagues/draft/grades";
import {
  countStarterSlots,
  toDraftGradePickInputs,
} from "@/lib/leagues/draft/grade-picks";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import {
  getDraftBySeasonId,
  getDraftPicks,
  getSeasonDraftTeams,
} from "@/lib/queries/draft";
import { getRankedPlayers } from "@/lib/queries/players";
import { getNflState } from "@/lib/sleeper/api";

export async function computeAndPersistDraftGrades(input: {
  draftId: string;
  leagueSeasonId: string;
  settings: LeagueSeasonSettings;
  scoringPreset: string;
  regularSeasonEndWeek: number;
  playoffTeamCount: number;
  teamIds: string[];
}): Promise<void> {
  const existing = await db
    .select({ id: draftGrades.id })
    .from(draftGrades)
    .where(eq(draftGrades.draftId, input.draftId))
    .limit(1);
  if (existing.length > 0) {
    return;
  }

  const scoringRules = resolveScoringRuleDefinitions(
    input.scoringPreset as ScoringPreset,
    input.settings.scoringRules,
  );

  const nfl = await getNflState().catch(() => null);
  const seasonYear = nfl?.season ?? String(new Date().getUTCFullYear());

  const [picks, ranked] = await Promise.all([
    getDraftPicks(input.draftId),
    getRankedPlayers({
      season: seasonYear,
      week: 0,
      kind: "projection",
      scoringRules,
    }).catch(() => []),
  ]);

  const rankedById = new Map(ranked.map((row) => [row.id, row]));
  const gradeInputs = toDraftGradePickInputs(picks, rankedById);

  const results = computeDraftGrades({
    teams: input.teamIds.map((teamId) => ({ teamId })),
    picks: gradeInputs,
    starterSlots: countStarterSlots(input.settings),
    regularSeasonWeeks: input.regularSeasonEndWeek,
    playoffTeamCount: input.playoffTeamCount,
  });

  if (results.length === 0) return;

  await db.insert(draftGrades).values(
    results.map((row) => ({
      draftId: input.draftId,
      teamId: row.teamId,
      letter: row.letter,
      score: row.score,
      leagueRank: row.leagueRank,
      teamCount: row.teamCount,
      projectedWins: row.projectedWins,
      projectedLosses: row.projectedLosses,
      playoffOdds: row.playoffOdds,
      championshipOdds: row.championshipOdds,
      bestValuePlayerId: row.bestValue?.playerId ?? null,
      bestValueOverall: row.bestValue?.overall ?? null,
      bestValueRound: row.bestValue?.round ?? null,
      bestValuePickInRound: row.bestValue?.pickInRound ?? null,
      bestValueAdp: row.bestValue?.adp ?? null,
      worstValuePlayerId: row.worstValue?.playerId ?? null,
      worstValueOverall: row.worstValue?.overall ?? null,
      worstValueRound: row.worstValue?.round ?? null,
      worstValuePickInRound: row.worstValue?.pickInRound ?? null,
      worstValueAdp: row.worstValue?.adp ?? null,
      headline: row.headline,
    })),
  );
}

/** Backfill grades for a completed draft that finished before this feature. */
export async function ensureDraftGradesForSeason(leagueSeasonId: string) {
  const [draft, seasonRows, seasonTeams] = await Promise.all([
    getDraftBySeasonId(leagueSeasonId),
    db
      .select()
      .from(leagueSeasons)
      .where(eq(leagueSeasons.id, leagueSeasonId))
      .limit(1),
    getSeasonDraftTeams(leagueSeasonId),
  ]);

  const season = seasonRows[0];
  if (!draft || draft.status !== "complete" || !season) {
    return;
  }

  await computeAndPersistDraftGrades({
    draftId: draft.id,
    leagueSeasonId: season.id,
    settings: season.settings,
    scoringPreset: season.scoringPreset,
    regularSeasonEndWeek: season.regularSeasonEndWeek,
    playoffTeamCount: season.playoffTeamCount,
    teamIds: seasonTeams.map((team) => team.id),
  });
}

export async function deleteDraftGradesForDraft(draftId: string) {
  await db.delete(draftGrades).where(eq(draftGrades.draftId, draftId));
}
