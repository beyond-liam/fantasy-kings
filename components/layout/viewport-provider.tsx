"use client";

import { createContext, useContext, type ReactNode } from "react";

const InitialIsMobileContext = createContext(false);

/** Seeds `useIsMobile` with the server's user-agent guess to avoid a layout flash. */
export function ViewportProvider({
  initialIsMobile,
  children,
}: {
  initialIsMobile: boolean;
  children: ReactNode;
}) {
  return (
    <InitialIsMobileContext.Provider value={initialIsMobile}>
      {children}
    </InitialIsMobileContext.Provider>
  );
}

export function useInitialIsMobile() {
  return useContext(InitialIsMobileContext);
}
