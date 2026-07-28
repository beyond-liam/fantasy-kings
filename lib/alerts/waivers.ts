import "server-only";

import { deliverAlert } from "@/lib/alerts/deliver";

export type WaiverProcessedAlert = {
  recipientUserId: string;
  leagueSeasonId: string;
  leaguePublicId: string;
  title: string;
  body: string;
  href: string;
  claimId: string;
  playerId: string;
};

/**
 * Waiver process day results → in-app only (email scope stays draft + trade).
 * One deliverAlert per recipient so the League Alert seam owns fan-out.
 */
export async function announceWaiverProcessed(
  alerts: WaiverProcessedAlert[],
): Promise<void> {
  if (alerts.length === 0) return;

  await Promise.all(
    alerts.map((alert) =>
      deliverAlert({
        userIds: [alert.recipientUserId],
        inApp: {
          leagueSeasonId: alert.leagueSeasonId,
          leaguePublicId: alert.leaguePublicId,
          type: "waiver_processed",
          title: alert.title,
          body: alert.body,
          href: alert.href,
          claimId: alert.claimId,
          playerId: alert.playerId,
        },
      }),
    ),
  );
}
