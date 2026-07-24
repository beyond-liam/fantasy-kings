import type {
  BracketChampion,
  BracketMatchup,
  BracketRound,
  BracketSlot,
  BracketTeam,
  PlayoffBracket,
} from "@/lib/leagues/playoff-bracket";
import {
  winnerOfFinalMatchup,
  winnerOfTwoWeekSeries,
} from "@/lib/leagues/playoffs/advance";

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

function withSeriesScore(
  slot: BracketSlot,
  seriesByTeamId: Map<string, number>,
): BracketSlot {
  if (slot.type !== "team" && slot.type !== "bye") {
    return slot;
  }
  const teamId = slot.team.teamId;
  if (!teamId || !seriesByTeamId.has(teamId)) {
    return slot;
  }
  return {
    ...slot,
    team: { ...slot.team, seriesScore: seriesByTeamId.get(teamId) ?? null },
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

function findRowForTeams(
  matchups: PlayoffMatchupScore[],
  week: number,
  teamA: string,
  teamB: string,
): PlayoffMatchupScore | undefined {
  return matchups.find(
    (row) =>
      row.week === week &&
      ((row.homeTeamId === teamA && row.awayTeamId === teamB) ||
        (row.homeTeamId === teamB && row.awayTeamId === teamA)),
  );
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

function championFromTeam(
  teamId: string,
  teamsById: Map<string, BracketTeam>,
  seriesPts: number | null,
): BracketChampion {
  const known = teamsById.get(teamId);
  return {
    teamId,
    teamPublicId: known?.teamPublicId ?? null,
    teamName: known?.teamName ?? "Champion",
    logoUrl: known?.logoUrl ?? null,
    seed: known?.seed ?? 0,
    seriesPts,
  };
}

function annotateMatchupSeries(
  matchup: BracketMatchup,
  seriesByTeamId: Map<string, number>,
): BracketMatchup {
  return {
    ...matchup,
    top: withSeriesScore(matchup.top, seriesByTeamId),
    bottom: withSeriesScore(matchup.bottom, seriesByTeamId),
  };
}

/**
 * After scores are overlaid, attach series totals and crown a champion when
 * the championship (or two-week series) is fully final.
 */
function resolveChampionshipOutcome(
  rounds: BracketRound[],
  matchups: PlayoffMatchupScore[],
  teamsById: Map<string, BracketTeam>,
): { rounds: BracketRound[]; champion: BracketChampion | null } {
  const g1Index = rounds.findIndex((round) => round.id === "championship");
  if (g1Index < 0) {
    return { rounds, champion: null };
  }

  const g1 = rounds[g1Index]!;
  const g1Week = parseWeekLabel(g1.weekLabel);
  const g1Matchup = g1.matchups[0];
  if (!g1Matchup || g1Week == null) {
    return { rounds, champion: null };
  }

  const topId = slotTeamId(g1Matchup.top);
  const bottomId = slotTeamId(g1Matchup.bottom);
  if (!topId || !bottomId) {
    return { rounds, champion: null };
  }

  const row1 = findRowForTeams(matchups, g1Week, topId, bottomId);
  const g2Index = rounds.findIndex((round) => round.id === "championship-g2");

  if (g2Index >= 0) {
    const g2 = rounds[g2Index]!;
    const g2Week = parseWeekLabel(g2.weekLabel);
    const g2Matchup = g2.matchups[0];
    if (!g2Matchup || g2Week == null) {
      return { rounds, champion: null };
    }

    const row2 = findRowForTeams(matchups, g2Week, topId, bottomId);
    if (
      !row1 ||
      !row2 ||
      row1.status !== "final" ||
      row2.status !== "final" ||
      row1.homePts == null ||
      row1.awayPts == null ||
      row2.homePts == null ||
      row2.awayPts == null
    ) {
      return { rounds, champion: null };
    }

    const homeTeamId = row1.homeTeamId;
    const awayTeamId = row1.awayTeamId;
    const seriesByTeamId = new Map<string, number>([
      [homeTeamId, row1.homePts + row2.homePts],
      [awayTeamId, row1.awayPts + row2.awayPts],
    ]);

    const winnerId = winnerOfTwoWeekSeries({
      homeTeamId,
      awayTeamId,
      leg1: {
        homePts: row1.homePts,
        awayPts: row1.awayPts,
        status: row1.status,
      },
      leg2: {
        homePts: row2.homePts,
        awayPts: row2.awayPts,
        status: row2.status,
      },
    });
    if (!winnerId) {
      return { rounds, champion: null };
    }

    const nextRounds = rounds.map((round, index) => {
      if (index !== g1Index && index !== g2Index) return round;
      return {
        ...round,
        matchups: round.matchups.map((matchup) =>
          annotateMatchupSeries(matchup, seriesByTeamId),
        ),
      };
    });

    return {
      rounds: nextRounds,
      champion: championFromTeam(
        winnerId,
        teamsById,
        seriesByTeamId.get(winnerId) ?? null,
      ),
    };
  }

  if (
    !row1 ||
    row1.status !== "final" ||
    row1.homePts == null ||
    row1.awayPts == null
  ) {
    return { rounds, champion: null };
  }

  const winnerId = winnerOfFinalMatchup({
    homeTeamId: row1.homeTeamId,
    awayTeamId: row1.awayTeamId,
    homePts: row1.homePts,
    awayPts: row1.awayPts,
    status: row1.status,
  });
  if (!winnerId) {
    return { rounds, champion: null };
  }

  const seriesPts =
    winnerId === row1.homeTeamId ? row1.homePts : row1.awayPts;

  return {
    rounds,
    champion: championFromTeam(winnerId, teamsById, seriesPts),
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

    // Two-week championship: Game 2 is a rematch of Game 1 finalists, not a winner advance.
    if (round.id === "championship" && nextRound.id === "championship-g2") {
      const nextMatchups = nextRound.matchups.map((matchup, index) => {
        const source = filled[index];
        if (!source) return matchup;
        const topId = slotTeamId(source.top);
        const bottomId = slotTeamId(source.bottom);
        if (!topId || !bottomId) return matchup;
        return {
          ...matchup,
          top: teamFromId(topId, teamsById, null),
          bottom: teamFromId(bottomId, teamsById, null),
        };
      });
      rounds[roundIndex + 1] = { ...nextRound, matchups: nextMatchups };
      continue;
    }

    const winners: Array<{ teamId: string; score: number | null }> = [];
    for (const matchup of filled) {
      const topId = slotTeamId(matchup.top);
      const bottomId = slotTeamId(matchup.bottom);
      if (!topId || !bottomId) continue;
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

  const outcome = resolveChampionshipOutcome(rounds, matchups, teamsById);
  return {
    ...bracket,
    rounds: outcome.rounds,
    champion: outcome.champion,
  };
}
