import { IDP_POSITION_IDS } from "@/lib/leagues/idp-positions";
import { formatLeaderPositionFullLabel } from "@/lib/leagues/league-position-stats";
import { formatPoints } from "@/lib/leagues/standings";
import {
  buildTeamH2hSeries,
  lastFinalMeetings,
  type TeamH2hMeeting,
  type TeamH2hSeries,
} from "@/lib/leagues/team-h2h";
import { getInjuryIndicator } from "@/lib/players/injury";
import type { TeamScheduleRow } from "@/lib/queries/matchups";

const LEADER_POSITIONS = [
  "QB",
  "RB",
  "WR",
  "TE",
  ...IDP_POSITION_IDS,
] as const;

export type GameCentrePreviewLeaderSide = {
  name: string;
  primaryPositionId: string;
  sleeperId: string | null;
  nflTeam: string | null;
  injuryStatus: string | null;
  line: string;
};

export type GameCentrePreviewLeader = {
  category: string;
  away: GameCentrePreviewLeaderSide;
  home: GameCentrePreviewLeaderSide;
};

export type GameCentrePreviewInjury = {
  side: "away" | "home";
  playerName: string;
  position: string;
  status: string;
  statusLabel: string;
  tone: "questionable" | "out";
};

export type GameCentrePreviewHistoryMeeting = {
  seasonYear: number;
  week: number;
  result: "W" | "L" | "T";
  focusPts: number;
  opponentPts: number;
  margin: number;
  publicId: string;
};

export type GameCentrePreview = {
  /** Series from the away team’s perspective vs home. */
  series: TeamH2hSeries;
  lastFive: GameCentrePreviewHistoryMeeting[];
  leaders: GameCentrePreviewLeader[];
  injuries: GameCentrePreviewInjury[];
};

type PreviewPlayer = {
  fullName: string;
  primaryPositionId: string;
  sleeperId: string | null;
  nflTeam: string | null;
  injuryStatus: string | null;
  projectedPts: number | null;
  seasonProjectedPts: number | null;
  isStarter: boolean;
};

function meetingSummary(
  meeting: TeamH2hMeeting,
): GameCentrePreviewHistoryMeeting | null {
  if (
    meeting.result == null ||
    meeting.margin == null ||
    meeting.viewerPts == null ||
    meeting.opponentPts == null
  ) {
    return null;
  }
  return {
    seasonYear: meeting.seasonYear,
    week: meeting.week,
    result: meeting.result,
    focusPts: meeting.viewerPts,
    opponentPts: meeting.opponentPts,
    margin: meeting.margin,
    publicId: meeting.publicId || meeting.id,
  };
}

function bestAtPosition(
  players: PreviewPlayer[],
  positionId: string,
): PreviewPlayer | null {
  let best: PreviewPlayer | null = null;
  let bestPts = Number.NEGATIVE_INFINITY;
  for (const player of players) {
    if (player.primaryPositionId !== positionId) continue;
    const pts = player.seasonProjectedPts ?? player.projectedPts;
    if (pts == null || !Number.isFinite(pts)) continue;
    if (pts > bestPts) {
      best = player;
      bestPts = pts;
    }
  }
  return best;
}

function emptyLeaderSide(): GameCentrePreviewLeaderSide {
  return {
    name: "—",
    primaryPositionId: "",
    sleeperId: null,
    nflTeam: null,
    injuryStatus: null,
    line: "—",
  };
}

function leaderSide(player: PreviewPlayer | null): GameCentrePreviewLeaderSide {
  if (!player) return emptyLeaderSide();
  const pts = player.seasonProjectedPts ?? player.projectedPts;
  return {
    name: player.fullName,
    primaryPositionId: player.primaryPositionId,
    sleeperId: player.sleeperId,
    nflTeam: player.nflTeam,
    injuryStatus: player.injuryStatus,
    line: pts == null ? "—" : `${formatPoints(pts)} proj`,
  };
}

export function buildSeasonLeaders(
  awayPlayers: PreviewPlayer[],
  homePlayers: PreviewPlayer[],
): GameCentrePreviewLeader[] {
  return LEADER_POSITIONS.map((positionId) => ({
    category: formatLeaderPositionFullLabel(positionId),
    away: leaderSide(bestAtPosition(awayPlayers, positionId)),
    home: leaderSide(bestAtPosition(homePlayers, positionId)),
  })).filter(
    (row) =>
      row.away.name !== "—" || row.home.name !== "—",
  );
}

export function buildInjuryReport(
  awayStarters: PreviewPlayer[],
  homeStarters: PreviewPlayer[],
): GameCentrePreviewInjury[] {
  const rows: GameCentrePreviewInjury[] = [];
  for (const [side, players] of [
    ["away", awayStarters],
    ["home", homeStarters],
  ] as const) {
    for (const player of players) {
      if (!player.isStarter) continue;
      const indicator = getInjuryIndicator(player.injuryStatus);
      if (!indicator) continue;
      rows.push({
        side,
        playerName: player.fullName,
        position: player.primaryPositionId,
        status: indicator.status,
        statusLabel: indicator.label,
        tone: indicator.tone,
      });
    }
  }
  return rows;
}

export function buildMatchupPreview(input: {
  focusSchedule: TeamScheduleRow[];
  opponentTeamId: string;
  seasonYear: number;
  awayPlayers: PreviewPlayer[];
  homePlayers: PreviewPlayer[];
}): GameCentrePreview {
  const series = buildTeamH2hSeries(
    input.focusSchedule,
    input.opponentTeamId,
    input.seasonYear,
  );
  const lastFive = lastFinalMeetings(series, 5)
    .map(meetingSummary)
    .filter((row): row is GameCentrePreviewHistoryMeeting => row != null);

  return {
    series,
    lastFive,
    leaders: buildSeasonLeaders(input.awayPlayers, input.homePlayers),
    injuries: buildInjuryReport(
      input.awayPlayers.filter((p) => p.isStarter),
      input.homePlayers.filter((p) => p.isStarter),
    ),
  };
}
