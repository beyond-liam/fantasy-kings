"use client";

/// <reference types="react/canary" />

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

type PageTransitionProps = {
  children: React.ReactNode;
};

/** Cross-fades route content via the View Transitions API. */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <ViewTransition
      key={pathname}
      name="page-content"
      enter="page-fade"
      exit="page-fade"
      share="page-fade"
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
