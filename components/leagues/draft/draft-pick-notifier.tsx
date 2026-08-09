"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

export const DRAFT_PICKS_EVENT = "draft-picks";

type DraftPickEvent = {
  overall: number;
  playerFullName: string;
  teamName: string;
  teamId: string;
  madeByUserId: string | null;
};

export type DraftPicksPollResponse = {
  status: "scheduled" | "live" | "paused" | "complete" | null;
  afterOverall: number;
  turnExpiresAt?: string | null;
  picks: DraftPickEvent[];
  error?: string;
};

type DraftPickNotifierProps = {
  slug: string;
  enabled: boolean;
  initialAfterOverall: number;
  /** Override for draft-route polling. Off-draft uses a slower cadence. */
  intervalMs?: number;
};

const DRAFT_ROUTE_INTERVAL_MS = 4_000;
const OFF_DRAFT_INTERVAL_MS = 12_000;

function isDraftRoute(pathname: string | null, slug: string) {
  return Boolean(pathname?.includes(`/league/${slug}/draft`));
}

export function DraftPickNotifier({
  slug,
  enabled,
  initialAfterOverall,
  intervalMs = DRAFT_ROUTE_INTERVAL_MS,
}: DraftPickNotifierProps) {
  const router = useRouter();
  const pathname = usePathname();
  const afterOverallRef = useRef(initialAfterOverall);
  const pathnameRef = useRef(pathname);
  const statusRef = useRef<DraftPicksPollResponse["status"] | undefined>(
    undefined,
  );

  useEffect(() => {
    afterOverallRef.current = initialAfterOverall;
  }, [initialAfterOverall]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let timeoutId = 0;

    const scheduleNext = (delayMs: number) => {
      if (cancelled) {
        return;
      }
      timeoutId = window.setTimeout(() => {
        void poll();
      }, delayMs);
    };

    const poll = async () => {
      const onDraft = isDraftRoute(pathnameRef.current, slug);
      const delayMs = onDraft
        ? intervalMs
        : Math.max(intervalMs, OFF_DRAFT_INTERVAL_MS);

      try {
        const response = await fetch(
          `/api/league/${encodeURIComponent(slug)}/draft/picks?after=${afterOverallRef.current}`,
          { cache: "no-store" },
        );
        if (!response.ok || cancelled) {
          scheduleNext(delayMs);
          return;
        }

        const data = (await response.json()) as DraftPicksPollResponse;
        if (cancelled) {
          return;
        }

        const previousStatus = statusRef.current;
        statusRef.current = data.status;

        if (typeof data.afterOverall === "number") {
          afterOverallRef.current = Math.max(
            afterOverallRef.current,
            data.afterOverall,
          );
        }

        let maxOverall = afterOverallRef.current;
        const sawNewPick = (data.picks?.length ?? 0) > 0;

        for (const pick of data.picks ?? []) {
          maxOverall = Math.max(maxOverall, pick.overall);
        }

        afterOverallRef.current = Math.max(
          maxOverall,
          data.afterOverall ?? maxOverall,
        );

        const statusChanged =
          previousStatus !== undefined && previousStatus !== data.status;

        // Always notify the draft room so the clock can adopt a fresh deadline
        // even when no new pick rows were returned yet.
        if (onDraft) {
          window.dispatchEvent(
            new CustomEvent(DRAFT_PICKS_EVENT, { detail: data }),
          );
        }

        // Status transitions (pause/complete) need a refresh even off-draft.
        if (statusChanged || sawNewPick) {
          router.refresh();
        }
      } catch {
        // Ignore transient poll errors.
      }

      scheduleNext(delayMs);
    };

    void poll();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [enabled, intervalMs, router, slug]);

  return null;
}
