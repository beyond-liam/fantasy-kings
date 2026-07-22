"use client";

import { usePathname } from "next/navigation";

import { AppTopNav } from "@/components/layout/app-top-nav";
import { PageTransition } from "@/components/layout/page-transition";
import { OnboardingDialog } from "@/components/auth/onboarding-dialog";
import type { AppAccountSummary } from "@/components/layout/app-top-nav";

export type { AppAccountSummary };

export function AppChrome({
  children,
  account,
}: Readonly<{
  children: React.ReactNode;
  account: AppAccountSummary;
}>) {
  const pathname = usePathname();
  const hideNav = pathname.startsWith("/login");

  if (hideNav) {
    return <PageTransition>{children}</PageTransition>;
  }

  return (
    <>
      <AppTopNav initialAccount={account} />
      {account ? <OnboardingDialog /> : null}
      <PageTransition>
        <div className="flex min-h-0 flex-1 flex-col pt-14">{children}</div>
      </PageTransition>
    </>
  );
}
