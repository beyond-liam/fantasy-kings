"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type LiveRefreshProps = {
  enabled: boolean;
  intervalMs?: number;
};

/** Soft-refresh the RSC tree while games are live. */
export function LiveRefresh({
  enabled,
  intervalMs = 30_000,
}: LiveRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const id = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
