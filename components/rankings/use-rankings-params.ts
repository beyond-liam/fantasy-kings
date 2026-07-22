"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** Params that change the underlying score dataset — require a server fetch. */
export const SERVER_RANKINGS_PARAMS = new Set([
  "season",
  "week",
  "kind",
  "scoring",
  "position",
  "team",
  "rookies",
]);

export function useRankingsParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      // Prefer live URL so client-only replaceState updates stack correctly.
      const current =
        typeof window !== "undefined"
          ? window.location.search
          : searchParams.toString();
      const params = new URLSearchParams(
        current.startsWith("?") ? current.slice(1) : current,
      );
      let touchesServer = false;

      for (const [key, value] of Object.entries(updates)) {
        if (SERVER_RANKINGS_PARAMS.has(key)) {
          touchesServer = true;
        }

        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const query = params.toString();
      const href = query ? `${pathname}?${query}` : pathname;

      if (touchesServer) {
        router.replace(href, { scroll: false });
        return;
      }

      window.history.replaceState(window.history.state, "", href);
      window.dispatchEvent(new Event("rankingsparams"));
    },
    [pathname, router, searchParams],
  );

  return updateParams;
}
