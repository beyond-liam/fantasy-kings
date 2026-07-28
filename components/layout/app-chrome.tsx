"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageTransition } from "@/components/layout/page-transition";

export function AppChrome({
  children,
  accountSlot,
}: Readonly<{
  children: React.ReactNode;
  accountSlot: ReactNode;
}>) {
  const pathname = usePathname();
  const hideNav = pathname.startsWith("/login");

  if (hideNav) {
    return <PageTransition>{children}</PageTransition>;
  }

  return (
    <>
      {accountSlot}
      {/* flex-1 must sit outside ViewTransition or the height chain collapses */}
      <div className="flex min-h-0 flex-1 flex-col pt-14">
        <PageTransition>{children}</PageTransition>
      </div>
    </>
  );
}
