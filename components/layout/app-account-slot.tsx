import { OnboardingDialog } from "@/components/auth/onboarding-dialog";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { PresenceHeartbeat } from "@/components/layout/presence-heartbeat";
import type { SessionAccountSummary } from "@/lib/queries/account";
import { getSessionAccountSummary } from "@/lib/queries/account";
import { getSessionUser } from "@/lib/auth/session";
import type { UserLeagueNavItem } from "@/lib/queries/leagues";
import { getUserLeagueNavItems } from "@/lib/queries/leagues";

function withFallback<T>(label: string, fallback: T) {
  return (error: unknown): T => {
    console.error(`[AppAccountSlot] ${label} failed`, error);
    return fallback;
  };
}

async function loadAccountChrome(): Promise<{
  account: SessionAccountSummary | null;
  leagues: UserLeagueNavItem[];
}> {
  const user = await getSessionUser().catch(withFallback("session lookup", null));
  if (!user) return { account: null, leagues: [] };

  // A failed profile/league read must not downgrade the header to signed out.
  const sessionOnlyAccount: SessionAccountSummary = {
    email: user.email ?? null,
    avatarUrl: null,
    username: null,
  };

  const [account, leagues] = await Promise.all([
    getSessionAccountSummary().catch(
      withFallback("account summary", sessionOnlyAccount),
    ),
    getUserLeagueNavItems(user.id).catch(
      withFallback<UserLeagueNavItem[]>("league nav", []),
    ),
  ]);

  return { account: account ?? sessionOnlyAccount, leagues };
}

/** Streams account chrome without blocking page children. */
export async function AppAccountSlot() {
  const { account, leagues } = await loadAccountChrome();

  return (
    <>
      <AppTopNav initialAccount={account} initialLeagues={leagues} />
      {account ? (
        <>
          <OnboardingDialog />
          <PresenceHeartbeat />
        </>
      ) : null}
    </>
  );
}
