import "server-only";

import { deliverAlert } from "@/lib/alerts/deliver";
import type { NotificationType } from "@/db/schema/notifications";

export {
  getTeamOwnerUserIds,
  getSeasonOwnerUserIds,
} from "@/lib/alerts/recipients";

/** In-app-only helper for call sites that do not need email. */
export async function notifyUsers(input: {
  userIds: Array<string | null | undefined>;
  excludeUserId?: string | null;
  leagueSeasonId: string;
  leaguePublicId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  tradeId?: string | null;
  claimId?: string | null;
  playerId?: string | null;
}) {
  await deliverAlert({
    userIds: input.userIds,
    excludeUserIds: input.excludeUserId ? [input.excludeUserId] : undefined,
    inApp: {
      leagueSeasonId: input.leagueSeasonId,
      leaguePublicId: input.leaguePublicId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      tradeId: input.tradeId,
      claimId: input.claimId,
      playerId: input.playerId,
    },
  });
}
