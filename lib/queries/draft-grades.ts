import { and, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";

import {
  draftGrades,
  drafts,
  leagues,
  leagueSeasons,
  playerExternalIds,
  players,
  teams,
} from "@/db/schema";
import { db } from "@/lib/db";
import type { DraftGradeLetter } from "@/lib/leagues/draft/grades";

export type UnseenDraftGrade = {
  id: string;
  draftId: string;
  teamId: string;
  letter: DraftGradeLetter;
  score: number;
  leagueRank: number;
  teamCount: number;
  projectedWins: number;
  projectedLosses: number;
  playoffOdds: number;
  championshipOdds: number;
  headline: string | null;
  teamName: string;
  teamLogoUrl: string | null;
  leagueName: string;
  bestValue: {
    playerId: string;
    fullName: string;
    sleeperId: string | null;
    primaryPositionId: string;
    nflTeam: string | null;
    overall: number;
    round: number;
    pickInRound: number;
    adp: number;
  } | null;
  worstValue: {
    playerId: string;
    fullName: string;
    sleeperId: string | null;
    primaryPositionId: string;
    nflTeam: string | null;
    overall: number;
    round: number;
    pickInRound: number;
    adp: number;
  } | null;
};

const bestPlayers = alias(players, "best_draft_grade_players");
const worstPlayers = alias(players, "worst_draft_grade_players");
const bestExternal = alias(playerExternalIds, "best_draft_grade_ext");
const worstExternal = alias(playerExternalIds, "worst_draft_grade_ext");

/**
 * Unseen draft grade for a manager's team (complete draft only).
 */
export const getUnseenDraftGradeForTeam = cache(
  async (input: {
    teamId: string;
    leagueSeasonId: string;
  }): Promise<UnseenDraftGrade | null> => {
    const [row] = await db
      .select({
        id: draftGrades.id,
        draftId: draftGrades.draftId,
        teamId: draftGrades.teamId,
        letter: draftGrades.letter,
        score: draftGrades.score,
        leagueRank: draftGrades.leagueRank,
        teamCount: draftGrades.teamCount,
        projectedWins: draftGrades.projectedWins,
        projectedLosses: draftGrades.projectedLosses,
        playoffOdds: draftGrades.playoffOdds,
        championshipOdds: draftGrades.championshipOdds,
        headline: draftGrades.headline,
        teamName: teams.name,
        teamLogoUrl: teams.logoUrl,
        leagueName: leagues.name,
        bestValuePlayerId: draftGrades.bestValuePlayerId,
        bestValueOverall: draftGrades.bestValueOverall,
        bestValueRound: draftGrades.bestValueRound,
        bestValuePickInRound: draftGrades.bestValuePickInRound,
        bestValueAdp: draftGrades.bestValueAdp,
        bestFullName: bestPlayers.fullName,
        bestPrimaryPositionId: bestPlayers.primaryPositionId,
        bestNflTeam: bestPlayers.nflTeam,
        bestSleeperId: bestExternal.externalId,
        worstValuePlayerId: draftGrades.worstValuePlayerId,
        worstValueOverall: draftGrades.worstValueOverall,
        worstValueRound: draftGrades.worstValueRound,
        worstValuePickInRound: draftGrades.worstValuePickInRound,
        worstValueAdp: draftGrades.worstValueAdp,
        worstFullName: worstPlayers.fullName,
        worstPrimaryPositionId: worstPlayers.primaryPositionId,
        worstNflTeam: worstPlayers.nflTeam,
        worstSleeperId: worstExternal.externalId,
      })
      .from(draftGrades)
      .innerJoin(drafts, eq(draftGrades.draftId, drafts.id))
      .innerJoin(teams, eq(draftGrades.teamId, teams.id))
      .innerJoin(leagueSeasons, eq(drafts.leagueSeasonId, leagueSeasons.id))
      .innerJoin(leagues, eq(leagueSeasons.leagueId, leagues.id))
      .leftJoin(bestPlayers, eq(draftGrades.bestValuePlayerId, bestPlayers.id))
      .leftJoin(
        bestExternal,
        and(
          eq(bestExternal.playerId, bestPlayers.id),
          eq(bestExternal.provider, "sleeper"),
        ),
      )
      .leftJoin(worstPlayers, eq(draftGrades.worstValuePlayerId, worstPlayers.id))
      .leftJoin(
        worstExternal,
        and(
          eq(worstExternal.playerId, worstPlayers.id),
          eq(worstExternal.provider, "sleeper"),
        ),
      )
      .where(
        and(
          eq(draftGrades.teamId, input.teamId),
          eq(drafts.leagueSeasonId, input.leagueSeasonId),
          eq(drafts.status, "complete"),
          isNull(draftGrades.seenAt),
        ),
      )
      .limit(1);

    if (!row) return null;

    const bestValue =
      row.bestValuePlayerId &&
      row.bestFullName &&
      row.bestValueOverall != null &&
      row.bestValueRound != null &&
      row.bestValuePickInRound != null &&
      row.bestValueAdp != null
        ? {
            playerId: row.bestValuePlayerId,
            fullName: row.bestFullName,
            sleeperId: row.bestSleeperId,
            primaryPositionId: row.bestPrimaryPositionId ?? "FLEX",
            nflTeam: row.bestNflTeam,
            overall: row.bestValueOverall,
            round: row.bestValueRound,
            pickInRound: row.bestValuePickInRound,
            adp: row.bestValueAdp,
          }
        : null;

    const worstValue =
      row.worstValuePlayerId &&
      row.worstFullName &&
      row.worstValueOverall != null &&
      row.worstValueRound != null &&
      row.worstValuePickInRound != null &&
      row.worstValueAdp != null
        ? {
            playerId: row.worstValuePlayerId,
            fullName: row.worstFullName,
            sleeperId: row.worstSleeperId,
            primaryPositionId: row.worstPrimaryPositionId ?? "FLEX",
            nflTeam: row.worstNflTeam,
            overall: row.worstValueOverall,
            round: row.worstValueRound,
            pickInRound: row.worstValuePickInRound,
            adp: row.worstValueAdp,
          }
        : null;

    return {
      id: row.id,
      draftId: row.draftId,
      teamId: row.teamId,
      letter: row.letter as DraftGradeLetter,
      score: row.score,
      leagueRank: row.leagueRank,
      teamCount: row.teamCount,
      projectedWins: row.projectedWins,
      projectedLosses: row.projectedLosses,
      playoffOdds: row.playoffOdds,
      championshipOdds: row.championshipOdds,
      headline: row.headline,
      teamName: row.teamName,
      teamLogoUrl: row.teamLogoUrl,
      leagueName: row.leagueName,
      bestValue,
      worstValue,
    };
  },
);
