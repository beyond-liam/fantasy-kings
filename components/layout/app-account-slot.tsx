import { OnboardingDialog } from "@/components/auth/onboarding-dialog";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { getSessionAccountSummary } from "@/lib/actions/account";

/** Streams account chrome without blocking page children. */
export async function AppAccountSlot() {
  const account = await getSessionAccountSummary();
  return (
    <>
      <AppTopNav initialAccount={account} />
      {account ? <OnboardingDialog /> : null}
    </>
  );
}
