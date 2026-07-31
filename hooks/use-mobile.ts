import * as React from "react"

import { useInitialIsMobile } from "@/components/layout/viewport-provider"
import { MOBILE_BREAKPOINT } from "@/lib/viewport"

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  const initialIsMobile = useInitialIsMobile()
  // Hydration reads this too, so the first client render matches the SSR HTML.
  const getServerSnapshot = React.useCallback(
    () => initialIsMobile,
    [initialIsMobile]
  )

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
