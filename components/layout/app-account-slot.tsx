import { OnboardingDialog } from "@/components/auth/onboarding-dialog";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { PresenceHeartbeat } from "@/components/layout/presence-heartbeat";
import { getSessionAccountSummary } from "@/lib/queries/account";
import { getSessionUser } from "@/lib/auth/session";
import { getUserLeagueNavItems } from "@/lib/queries/leagues";

/** Streams account chrome without blocking page children. */
export async function AppAccountSlot() {
  try {
    const user = await getSessionUser();
    const [account, leagues] = await Promise.all([
      getSessionAccountSummary(),
      user ? getUserLeagueNavItems(user.id) : Promise.resolve([]),
    ]);

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
  } catch (error) {
    console.error("[AppAccountSlot] failed to load account chrome", error);
    return <AppTopNav initialAccount={null} initialLeagues={[]} />;
  }
}
