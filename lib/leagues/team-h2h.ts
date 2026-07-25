import { formatRecord } from "@/lib/leagues/standings";
import type { TeamScheduleRow } from "@/lib/queries/matchups";

const TIE_EPSILON = 0.05;

export type TeamH2hMeeting = {
  id: string;
  publicId: string;
  seasonYear: number;
  week: number;
  status: TeamScheduleRow["status"];
  isHome: boolean;
  viewerPts: number | null;
  opponentPts: number | null;
  result: "W" | "L" | "T" | null;
  /** Viewer margin (positive = viewer won by). */
  margin: number | null;
};

export type TeamH2hSeries = {
  wins: number;
  losses: number;
  ties: number;
  recordLabel: string;
  /** Average points scored by viewer in finalized meetings. */
  avgPf: number | null;
  /** Average margin in finalized games (viewer perspective). */
  avgMargin: number | null;
  streak: string | null;
  longestWinStreak: number;
  longestLossStreak: number;
  bestWin: TeamH2hMeeting | null;
  worstLoss: TeamH2hMeeting | null;
  /** Largest absolute margin (viewer perspective). */
  biggestBlowout: TeamH2hMeeting | null;
  /** Smallest absolute margin among finalized games. */
  closestGame: TeamH2hMeeting | null;
  meetings: TeamH2hMeeting[];
};

/** Most recent finalized meetings, newest first. */
export function lastFinalMeetings(
  series: TeamH2hSeries,
  limit: number,
): TeamH2hMeeting[] {
  return series.meetings
    .filter((meeting) => meeting.result != null)
    .toReversed()
    .slice(0, Math.max(0, limit));
}

function streakFromResults(results: Array<"W" | "L" | "T">): string | null {
  if (results.length === 0) return null;
  const last = results[results.length - 1]!;
  if (last === "T") return "T1";
  let length = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] !== last) break;
    length += 1;
  }
  return `${last}${length}`;
}

function longestKindStreak(
  results: Array<"W" | "L" | "T">,
  kind: "W" | "L",
): number {
  let best = 0;
  let current = 0;
  for (const result of results) {
    if (result === kind) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

/** Build viewer-vs-opponent H2H series from the viewer's schedule rows. */
export function buildTeamH2hSeries(
  scheduleRows: TeamScheduleRow[],
  opponentTeamId: string,
  seasonYear: number,
): TeamH2hSeries {
  const meetings: TeamH2hMeeting[] = scheduleRows
    .filter((row) => row.opponentTeamId === opponentTeamId)
    .map((row) => {
      const viewerPts = row.isHome ? row.homePts : row.awayPts;
      const opponentPts = row.isHome ? row.awayPts : row.homePts;
      let result: "W" | "L" | "T" | null = null;
      let margin: number | null = null;
      if (
        row.status === "final" &&
        viewerPts != null &&
        opponentPts != null &&
        Number.isFinite(viewerPts) &&
        Number.isFinite(opponentPts)
      ) {
        margin = Math.round((viewerPts - opponentPts) * 10) / 10;
        if (Math.abs(margin) <= TIE_EPSILON) result = "T";
        else if (margin > 0) result = "W";
        else result = "L";
      }
      return {
        id: row.id,
        publicId: row.publicId,
        seasonYear,
        week: row.week,
        status: row.status,
        isHome: row.isHome,
        viewerPts,
        opponentPts,
        result,
        margin,
      };
    })
    .toSorted((a, b) => a.week - b.week);

  let wins = 0;
  let losses = 0;
  let ties = 0;
  let marginSum = 0;
  let pfSum = 0;
  let finalCount = 0;
  const results: Array<"W" | "L" | "T"> = [];
  let bestWin: TeamH2hMeeting | null = null;
  let worstLoss: TeamH2hMeeting | null = null;
  let biggestBlowout: TeamH2hMeeting | null = null;
  let closestGame: TeamH2hMeeting | null = null;

  for (const meeting of meetings) {
    if (meeting.result == null || meeting.margin == null) continue;
    if (meeting.viewerPts != null) {
      pfSum += meeting.viewerPts;
    }
    if (meeting.result === "W") {
      wins += 1;
      if (!bestWin || meeting.margin > (bestWin.margin ?? 0)) {
        bestWin = meeting;
      }
    } else if (meeting.result === "L") {
      losses += 1;
      if (!worstLoss || meeting.margin < (worstLoss.margin ?? 0)) {
        worstLoss = meeting;
      }
    } else {
      ties += 1;
    }
    const absMargin = Math.abs(meeting.margin);
    if (
      !biggestBlowout ||
      absMargin > Math.abs(biggestBlowout.margin ?? 0)
    ) {
      biggestBlowout = meeting;
    }
    if (
      !closestGame ||
      absMargin < Math.abs(closestGame.margin ?? 0)
    ) {
      closestGame = meeting;
    }
    results.push(meeting.result);
    marginSum += meeting.margin;
    finalCount += 1;
  }

  return {
    wins,
    losses,
    ties,
    recordLabel: formatRecord(wins, losses, ties),
    avgPf:
      finalCount > 0 ? Math.round((pfSum / finalCount) * 10) / 10 : null,
    avgMargin:
      finalCount > 0
        ? Math.round((marginSum / finalCount) * 10) / 10
        : null,
    streak: streakFromResults(results),
    longestWinStreak: longestKindStreak(results, "W"),
    longestLossStreak: longestKindStreak(results, "L"),
    bestWin,
    worstLoss,
    biggestBlowout,
    closestGame,
    meetings,
  };
}
