import { OnboardingDialog } from "@/components/auth/onboarding-dialog";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { PresenceHeartbeat } from "@/components/layout/presence-heartbeat";
import type { SessionAccountSummary } from "@/lib/queries/account";
import { getSessionAccountSummary } from "@/lib/queries/account";
import { getSessionUser } from "@/lib/auth/session";
import type { UserLeagueNavItem } from "@/lib/queries/leagues";
import { getUserLeagueNavItems } from "@/lib/queries/leagues";

async function loadAccountChrome(): Promise<{
  account: SessionAccountSummary | null;
  leagues: UserLeagueNavItem[];
}> {
  try {
    const user = await getSessionUser();
    const [account, leagues] = await Promise.all([
      getSessionAccountSummary(),
      user ? getUserLeagueNavItems(user.id) : Promise.resolve([]),
    ]);
    return { account, leagues };
  } catch (error) {
    console.error("[AppAccountSlot] failed to load account chrome", error);
    return { account: null, leagues: [] };
  }
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
