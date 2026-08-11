"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import type { GameCentreLivePatch } from "@/lib/leagues/game-centre/game-centre-live-patch";
import type { MatchupBoardLivePatch } from "@/lib/leagues/matchups/board-live-patch";

export const LIVE_SCORES_BOARD_EVENT = "live-scores-board";
export const LIVE_SCORES_GAME_CENTRE_EVENT = "live-scores-game-centre";

export type LiveScoresFreshness = {
  season: string;
  week: number;
  kind?: "stats" | "projection";
  seasonType?: string;
  /** ISO timestamp from the initial RSC load. */
  initialUpdatedAt: string | null;
};

type LiveRefreshProps = {
  enabled: boolean;
  intervalMs?: number;
  /**
   * When set, poll a tiny freshness endpoint and only act when
   * `player_scores.updated_at` advances.
   */
  freshness?: LiveScoresFreshness;
  /**
   * When set with `freshness`, fetch this URL on advance and dispatch
   * `LIVE_SCORES_BOARD_EVENT` instead of `router.refresh()`.
   * Falls back to refresh if the patch request fails.
   */
  boardPatchUrl?: string;
  /**
   * When set with `freshness`, fetch this URL on advance and dispatch
   * `LIVE_SCORES_GAME_CENTRE_EVENT` instead of `router.refresh()`.
   * Mutually exclusive with `boardPatchUrl` on a given page.
   */
  gameCentrePatchUrl?: string;
};

type FreshnessResponse = {
  updatedAt: string | null;
  error?: string;
};

/** Soft-refresh scores while games are live. */
export function LiveRefresh({
  enabled,
  intervalMs = 30_000,
  freshness,
  boardPatchUrl,
  gameCentrePatchUrl,
}: LiveRefreshProps) {
  const router = useRouter();
  const updatedAtRef = useRef(freshness?.initialUpdatedAt ?? null);
  const patchUrl = gameCentrePatchUrl ?? boardPatchUrl ?? null;
  const patchEvent = gameCentrePatchUrl
    ? LIVE_SCORES_GAME_CENTRE_EVENT
    : boardPatchUrl
      ? LIVE_SCORES_BOARD_EVENT
      : null;

  useEffect(() => {
    updatedAtRef.current = freshness?.initialUpdatedAt ?? null;
  }, [freshness?.initialUpdatedAt]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let timeoutId = 0;

    const scheduleNext = () => {
      if (cancelled) return;
      timeoutId = window.setTimeout(() => {
        void tick();
      }, intervalMs);
    };

    const tick = async () => {
      if (document.visibilityState === "hidden") {
        scheduleNext();
        return;
      }

      if (!freshness) {
        router.refresh();
        scheduleNext();
        return;
      }

      try {
        const params = new URLSearchParams({
          season: freshness.season,
          week: String(freshness.week),
          kind: freshness.kind ?? "stats",
          seasonType: freshness.seasonType ?? "regular",
        });
        const response = await fetch(`/api/scores/freshness?${params}`, {
          cache: "no-store",
        });
        if (!response.ok || cancelled) {
          scheduleNext();
          return;
        }

        const data = (await response.json()) as FreshnessResponse;
        if (cancelled) return;

        const next = data.updatedAt ?? null;
        const prev = updatedAtRef.current;
        if (next != null && next !== prev) {
          updatedAtRef.current = next;

          if (patchUrl && patchEvent) {
            try {
              const patchResponse = await fetch(patchUrl, {
                cache: "no-store",
              });
              if (patchResponse.ok && !cancelled) {
                const patch = (await patchResponse.json()) as
                  | MatchupBoardLivePatch
                  | GameCentreLivePatch;
                window.dispatchEvent(
                  new CustomEvent(patchEvent, { detail: patch }),
                );
                scheduleNext();
                return;
              }
            } catch {
              // Fall through to full RSC refresh.
            }
          }

          if (!cancelled) {
            router.refresh();
          }
        }
      } catch {
        // Ignore transient poll errors; try again next interval.
      }

      scheduleNext();
    };

    void tick();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [enabled, freshness, intervalMs, patchEvent, patchUrl, router]);

  return null;
}
