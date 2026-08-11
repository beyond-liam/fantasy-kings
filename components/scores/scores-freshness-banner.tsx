"use client";

import { useEffect, useState } from "react";

import {
  LIVE_SCORES_BOARD_EVENT,
  LIVE_SCORES_GAME_CENTRE_EVENT,
} from "@/components/scores/live-refresh";

type ScoresFreshnessBannerProps = {
  /** ISO timestamp of latest player_scores update for this week. */
  updatedAt: string | null;
  /** True when any NFL game on the board is in progress. */
  hasLiveNflGames?: boolean;
};

type LiveScoresBannerPatch = {
  updatedAt: string | null;
  hasLiveNflGames: boolean;
};

function formatLastUpdated(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Live-only freshness line. Hidden when no NFL games are in progress.
 * Listens for board / Game Centre soft-patches so the timestamp advances
 * without RSC reload.
 */
export function ScoresFreshnessBanner({
  updatedAt,
  hasLiveNflGames = false,
}: ScoresFreshnessBannerProps) {
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(updatedAt);
  const [prevUpdatedAt, setPrevUpdatedAt] = useState(updatedAt);
  const [liveHasGames, setLiveHasGames] = useState(hasLiveNflGames);
  const [prevHasGames, setPrevHasGames] = useState(hasLiveNflGames);

  if (updatedAt !== prevUpdatedAt) {
    setPrevUpdatedAt(updatedAt);
    setLiveUpdatedAt(updatedAt);
  }

  if (hasLiveNflGames !== prevHasGames) {
    setPrevHasGames(hasLiveNflGames);
    setLiveHasGames(hasLiveNflGames);
  }

  useEffect(() => {
    const onPatch = (event: Event) => {
      const detail = (event as CustomEvent<LiveScoresBannerPatch>).detail;
      if (!detail) {
        return;
      }
      if (detail.updatedAt != null) {
        setLiveUpdatedAt(detail.updatedAt);
      }
      setLiveHasGames(detail.hasLiveNflGames);
    };
    window.addEventListener(LIVE_SCORES_BOARD_EVENT, onPatch);
    window.addEventListener(LIVE_SCORES_GAME_CENTRE_EVENT, onPatch);
    return () => {
      window.removeEventListener(LIVE_SCORES_BOARD_EVENT, onPatch);
      window.removeEventListener(LIVE_SCORES_GAME_CENTRE_EVENT, onPatch);
    };
  }, []);

  if (!liveHasGames || !liveUpdatedAt) {
    return null;
  }

  const date = new Date(liveUpdatedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return (
    <p
      className="text-xs text-muted-foreground tabular-nums"
      suppressHydrationWarning
      title={date.toISOString()}
    >
      Last updated: {formatLastUpdated(date)}
    </p>
  );
}
