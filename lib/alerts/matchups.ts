import "server-only";

import {
  createNotifications,
  matchupHref,
  type CreateNotificationInput,
} from "@/lib/notifications/create";
import { getTeamOwnerUserIds } from "@/lib/alerts/recipients";
import { logLeagueActivity } from "@/lib/leagues/activity-log";

function formatPts(value: number) {
  return value.toFixed(1);
}

function ptsChanged(
  before: number | null | undefined,
  after: number | null | undefined,
) {
  if (before == null || after == null) return false;
  return Math.abs(before - after) > 0.05;
}

/**
 * Notify both managers when a matchup first becomes final.
 * Call only on scheduled/in_progress → final transitions.
 */
export async function announceMatchupFinalized(input: {
  matchupId: string;
  matchupPublicId: string;
  leagueSeasonId: string;
  leaguePublicId: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homePts: number;
  awayPts: number;
  homeTeamName: string;
  awayTeamName: string;
}) {
  const owners = await getTeamOwnerUserIds([
    input.homeTeamId,
    input.awayTeamId,
  ]);
  const href = matchupHref(input.leaguePublicId, input.matchupPublicId);
  const homeWon = input.homePts > input.awayPts + 0.05;
  const awayWon = input.awayPts > input.homePts + 0.05;
  const tie = !homeWon && !awayWon;

  const rows: CreateNotificationInput[] = [];

  const homeUserId = owners.get(input.homeTeamId);
  if (homeUserId) {
    const result = tie ? "tied" : homeWon ? "won" : "lost";
    rows.push({
      recipientUserId: homeUserId,
      leagueSeasonId: input.leagueSeasonId,
      type: "matchup_result",
      title: `Week ${input.week} ${result}`,
      body: tie
        ? `You tied ${input.awayTeamName} ${formatPts(input.homePts)}–${formatPts(input.awayPts)}.`
        : homeWon
          ? `You beat ${input.awayTeamName} ${formatPts(input.homePts)}–${formatPts(input.awayPts)}.`
          : `You lost to ${input.awayTeamName} ${formatPts(input.homePts)}–${formatPts(input.awayPts)}.`,
      href,
      matchupId: input.matchupId,
    });
  }

  const awayUserId = owners.get(input.awayTeamId);
  if (awayUserId) {
    const result = tie ? "tied" : awayWon ? "won" : "lost";
    rows.push({
      recipientUserId: awayUserId,
      leagueSeasonId: input.leagueSeasonId,
      type: "matchup_result",
      title: `Week ${input.week} ${result}`,
      body: tie
        ? `You tied ${input.homeTeamName} ${formatPts(input.awayPts)}–${formatPts(input.homePts)}.`
        : awayWon
          ? `You beat ${input.homeTeamName} ${formatPts(input.awayPts)}–${formatPts(input.homePts)}.`
          : `You lost to ${input.homeTeamName} ${formatPts(input.awayPts)}–${formatPts(input.homePts)}.`,
      href,
      matchupId: input.matchupId,
    });
  }

  await createNotifications(rows);
}

/**
 * League activity + owner notifications when a finalized matchup's points change
 * (official stat corrections).
 */
export async function announceScoreCorrected(input: {
  matchupId: string;
  matchupPublicId: string;
  leagueSeasonId: string;
  leaguePublicId: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homePtsBefore: number;
  awayPtsBefore: number;
  homePtsAfter: number;
  awayPtsAfter: number;
}) {
  const homeChanged = ptsChanged(input.homePtsBefore, input.homePtsAfter);
  const awayChanged = ptsChanged(input.awayPtsBefore, input.awayPtsAfter);
  if (!homeChanged && !awayChanged) {
    return;
  }

  const beforeLabel = `${input.awayTeamName} ${formatPts(input.awayPtsBefore)}–${formatPts(input.homePtsBefore)} ${input.homeTeamName}`;
  const afterLabel = `${input.awayTeamName} ${formatPts(input.awayPtsAfter)}–${formatPts(input.homePtsAfter)} ${input.homeTeamName}`;

  await logLeagueActivity({
    leagueSeasonId: input.leagueSeasonId,
    type: "score_corrected",
    summary: `Week ${input.week} score corrected: ${afterLabel} (was ${beforeLabel})`,
    metadata: {
      matchupId: input.matchupId,
      matchupPublicId: input.matchupPublicId,
      week: input.week,
      homeTeamName: input.homeTeamName,
      awayTeamName: input.awayTeamName,
      homePtsBefore: input.homePtsBefore,
      awayPtsBefore: input.awayPtsBefore,
      homePtsAfter: input.homePtsAfter,
      awayPtsAfter: input.awayPtsAfter,
    },
  });

  const owners = await getTeamOwnerUserIds([
    input.homeTeamId,
    input.awayTeamId,
  ]);
  const href = matchupHref(input.leaguePublicId, input.matchupPublicId);
  const rows: CreateNotificationInput[] = [];

  const homeUserId = owners.get(input.homeTeamId);
  if (homeUserId) {
    rows.push({
      recipientUserId: homeUserId,
      leagueSeasonId: input.leagueSeasonId,
      type: "matchup_result",
      title: `Week ${input.week} score corrected`,
      body: `Your matchup vs ${input.awayTeamName} is now ${formatPts(input.homePtsAfter)}–${formatPts(input.awayPtsAfter)} (was ${formatPts(input.homePtsBefore)}–${formatPts(input.awayPtsBefore)}).`,
      href,
      matchupId: input.matchupId,
    });
  }

  const awayUserId = owners.get(input.awayTeamId);
  if (awayUserId) {
    rows.push({
      recipientUserId: awayUserId,
      leagueSeasonId: input.leagueSeasonId,
      type: "matchup_result",
      title: `Week ${input.week} score corrected`,
      body: `Your matchup vs ${input.homeTeamName} is now ${formatPts(input.awayPtsAfter)}–${formatPts(input.homePtsAfter)} (was ${formatPts(input.awayPtsBefore)}–${formatPts(input.homePtsBefore)}).`,
      href,
      matchupId: input.matchupId,
    });
  }

  await createNotifications(rows);
}
