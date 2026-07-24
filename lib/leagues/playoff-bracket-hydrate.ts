import type {
  BracketMatchup,
  BracketSlot,
  BracketTeam,
  PlayoffBracket,
} from "@/lib/leagues/playoff-bracket";
import { winnerOfFinalMatchup } from "@/lib/leagues/playoffs/advance";

export type PlayoffMatchupScore = {
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homePts: number | null;
  awayPts: number | null;
  status: string;
};

function parseWeekLabel(weekLabel: string): number | null {
  const match = /^Week\s+(\d+)$/i.exec(weekLabel.trim());
  if (!match) return null;
  const week = Number(match[1]);
  return Number.isFinite(week) ? week : null;
}

function slotTeamId(slot: BracketSlot): string | null {
  if (slot.type === "team" || slot.type === "bye") {
    return slot.team.teamId;
  }
  return null;
}

function withScore(slot: BracketSlot, score: number | null | undefined): BracketSlot {
  if (slot.type !== "team" && slot.type !== "bye") {
    return slot;
  }
  return {
    ...slot,
    team: { ...slot.team, score: score ?? null },
  };
}

function teamFromId(
  teamId: string,
  teamsById: Map<string, BracketTeam>,
  score: number | null,
): BracketSlot {
  const known = teamsById.get(teamId);
  if (known) {
    return {
      type: "team",
      team: { ...known, score },
    };
  }
  return {
    type: "team",
    team: {
      seed: 0,
      teamId,
      teamPublicId: null,
      teamName: "Winner",
      logoUrl: null,
      score,
    },
  };
}

function matchupTeamsMatch(
  matchup: BracketMatchup,
  row: PlayoffMatchupScore,
): boolean {
  const topId = slotTeamId(matchup.top);
  const bottomId = slotTeamId(matchup.bottom);
  if (!topId || !bottomId) return false;
  const ids = new Set([topId, bottomId]);
  return ids.has(row.homeTeamId) && ids.has(row.awayTeamId);
}

function applyRowToMatchup(
  matchup: BracketMatchup,
  row: PlayoffMatchupScore,
): BracketMatchup {
  const topId = slotTeamId(matchup.top);
  const bottomId = slotTeamId(matchup.bottom);
  let topScore: number | null = null;
  let bottomScore: number | null = null;
  if (topId === row.homeTeamId) {
    topScore = row.homePts;
    bottomScore = row.awayPts;
  } else if (topId === row.awayTeamId) {
    topScore = row.awayPts;
    bottomScore = row.homePts;
  } else if (bottomId === row.homeTeamId) {
    bottomScore = row.homePts;
    topScore = row.awayPts;
  } else {
    topScore = row.homePts;
    bottomScore = row.awayPts;
  }
  return {
    ...matchup,
    top: withScore(matchup.top, topScore),
    bottom: withScore(matchup.bottom, bottomScore),
  };
}

/**
 * Overlay playoff matchup scores onto the projected bracket and promote
 * winners into TBD slots for later rounds.
 */
export function hydratePlayoffBracket(
  bracket: PlayoffBracket,
  matchups: PlayoffMatchupScore[],
  seedTeams: BracketTeam[],
): PlayoffBracket {
  if (matchups.length === 0) {
    return bracket;
  }

  const teamsById = new Map(
    seedTeams
      .filter((team): team is BracketTeam & { teamId: string } =>
        Boolean(team.teamId),
      )
      .map((team) => [team.teamId, team]),
  );

  const rounds = bracket.rounds.map((round) => ({
    ...round,
    matchups: round.matchups.map((matchup) => ({
      ...matchup,
      top: { ...matchup.top },
      bottom: { ...matchup.bottom },
    })),
  }));

  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
    const round = rounds[roundIndex]!;
    const week = parseWeekLabel(round.weekLabel);
    if (week == null) continue;

    const weekRows = matchups.filter((row) => row.week === week);
    if (weekRows.length === 0) continue;

    const used = new Set<number>();
    const filled: BracketMatchup[] = round.matchups.map((matchup) => {
      const exactIndex = weekRows.findIndex(
        (row, index) => !used.has(index) && matchupTeamsMatch(matchup, row),
      );
      if (exactIndex >= 0) {
        used.add(exactIndex);
        return applyRowToMatchup(matchup, weekRows[exactIndex]!);
      }
      return matchup;
    });

    // Fill remaining by bracket order (later rounds start as TBD).
    for (let i = 0; i < filled.length; i++) {
      if (used.size >= weekRows.length) break;
      const matchup = filled[i]!;
      const topId = slotTeamId(matchup.top);
      const bottomId = slotTeamId(matchup.bottom);
      if (topId && bottomId) continue;
      const nextIndex = weekRows.findIndex((_, index) => !used.has(index));
      if (nextIndex < 0) break;
      used.add(nextIndex);
      const row = weekRows[nextIndex]!;
      filled[i] = {
        id: matchup.id,
        top: topId
          ? withScore(
              matchup.top,
              topId === row.homeTeamId ? row.homePts : row.awayPts,
            )
          : teamFromId(row.homeTeamId, teamsById, row.homePts),
        bottom: bottomId
          ? withScore(
              matchup.bottom,
              bottomId === row.homeTeamId ? row.homePts : row.awayPts,
            )
          : teamFromId(row.awayTeamId, teamsById, row.awayPts),
      };
    }

    rounds[roundIndex] = { ...round, matchups: filled };

    const nextRound = rounds[roundIndex + 1];
    if (!nextRound) continue;

    const winners: Array<{ teamId: string; score: number | null }> = [];
    for (const matchup of filled) {
      const topId = slotTeamId(matchup.top);
      const bottomId = slotTeamId(matchup.bottom);
      if (!topId || !bottomId) continue;
      const topScore =
        matchup.top.type === "team" || matchup.top.type === "bye"
          ? (matchup.top.team.score ?? null)
          : null;
      const bottomScore =
        matchup.bottom.type === "team" || matchup.bottom.type === "bye"
          ? (matchup.bottom.team.score ?? null)
          : null;
      // Infer home/away from scores when we have a final pairing in DB.
      const row = weekRows.find(
        (candidate) =>
          (candidate.homeTeamId === topId &&
            candidate.awayTeamId === bottomId) ||
          (candidate.homeTeamId === bottomId &&
            candidate.awayTeamId === topId),
      );
      if (!row || row.status !== "final") continue;
      const winnerId = winnerOfFinalMatchup({
        homeTeamId: row.homeTeamId,
        awayTeamId: row.awayTeamId,
        homePts: row.homePts,
        awayPts: row.awayPts,
        status: row.status,
      });
      if (!winnerId) continue;
      const score =
        winnerId === row.homeTeamId ? row.homePts : row.awayPts;
      winners.push({ teamId: winnerId, score });
      void topScore;
      void bottomScore;
    }

    if (winners.length === 0) continue;

    let winnerIndex = 0;
    const nextMatchups = nextRound.matchups.map((matchup) => {
      let top = matchup.top;
      let bottom = matchup.bottom;
      if (top.type === "tbd" && winnerIndex < winners.length) {
        const winner = winners[winnerIndex++]!;
        top = teamFromId(winner.teamId, teamsById, null);
      }
      if (bottom.type === "tbd" && winnerIndex < winners.length) {
        const winner = winners[winnerIndex++]!;
        bottom = teamFromId(winner.teamId, teamsById, null);
      }
      return { ...matchup, top, bottom };
    });
    rounds[roundIndex + 1] = { ...nextRound, matchups: nextMatchups };
  }

  return { ...bracket, rounds };
}
