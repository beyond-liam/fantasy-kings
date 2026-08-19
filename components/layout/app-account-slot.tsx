import { OnboardingDialog } from "@/components/auth/onboarding-dialog";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { PresenceHeartbeat } from "@/components/layout/presence-heartbeat";
import type { NotificationsPayload } from "@/lib/actions/notifications";
import { getSessionUser } from "@/lib/auth/session";
import type { SessionAccountSummary } from "@/lib/queries/account";
import { getSessionAccountSummary } from "@/lib/queries/account";
import type { UserLeagueNavItem } from "@/lib/queries/leagues";
import { getUserLeagueNavItems } from "@/lib/queries/leagues";
import {
  getUnreadNotificationCount,
  getUserNotifications,
} from "@/lib/queries/notifications";

function withFallback<T>(label: string, fallback: T) {
  return (error: unknown): T => {
    console.error(`[AppAccountSlot] ${label} failed`, error);
    return fallback;
  };
}

const EMPTY_NOTIFICATIONS: NotificationsPayload = {
  items: [],
  unreadCount: 0,
};

async function loadAccountChrome(): Promise<{
  account: SessionAccountSummary | null;
  leagues: UserLeagueNavItem[];
  notifications: NotificationsPayload;
}> {
  const user = await getSessionUser().catch(withFallback("session lookup", null));
  if (!user) {
    return { account: null, leagues: [], notifications: EMPTY_NOTIFICATIONS };
  }

  // A failed profile/league read must not downgrade the header to signed out.
  const sessionOnlyAccount: SessionAccountSummary = {
    email: user.email ?? null,
    avatarUrl: null,
    username: null,
    needsOnboarding: false,
  };

  const [account, leagues, notifications] = await Promise.all([
    getSessionAccountSummary().catch(
      withFallback("account summary", sessionOnlyAccount),
    ),
    getUserLeagueNavItems(user.id).catch(
      withFallback<UserLeagueNavItem[]>("league nav", []),
    ),
    Promise.all([
      getUserNotifications(user.id),
      getUnreadNotificationCount(user.id),
    ])
      .then(([items, unreadCount]) => ({ items, unreadCount }))
      .catch(withFallback("notifications", EMPTY_NOTIFICATIONS)),
  ]);

  return {
    account: account ?? sessionOnlyAccount,
    leagues,
    notifications,
  };
}

/** Streams account chrome without blocking page children. */
export async function AppAccountSlot() {
  const { account, leagues, notifications } = await loadAccountChrome();

  return (
    <>
      <AppTopNav
        initialAccount={account}
        initialLeagues={leagues}
        initialNotifications={notifications}
      />
      {account ? (
        <>
          <OnboardingDialog
            email={account.email}
            needsOnboarding={account.needsOnboarding}
          />
          <PresenceHeartbeat />
        </>
      ) : null}
    </>
  );
}
