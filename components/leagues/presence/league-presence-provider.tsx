"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { PresenceStatus } from "@/lib/presence";
import type { LeaguePresenceSnapshot } from "@/lib/queries/presence";

export type LeaguePresenceEntry = {
  status: PresenceStatus;
  lastSeenAt: string;
};

type LeaguePresenceContextValue = {
  byUserId: ReadonlyMap<string, LeaguePresenceEntry>;
  nflSeasonType: string | null;
};

const LeaguePresenceContext =
  createContext<LeaguePresenceContextValue | null>(null);

const PRESENCE_POLL_INTERVAL_MS = 60_000;
/** Avoid racing the league page's first DB waterfalls on free-tier max:1. */
const PRESENCE_INITIAL_DELAY_MS = 4_000;
const EMPTY_MAP: ReadonlyMap<string, LeaguePresenceEntry> = new Map();

function toMap(
  members: LeaguePresenceSnapshot["members"],
): Map<string, LeaguePresenceEntry> {
  const map = new Map<string, LeaguePresenceEntry>();
  for (const member of members) {
    map.set(member.userId, {
      status: member.status,
      lastSeenAt: member.lastSeenAt,
    });
  }
  return map;
}

export function LeaguePresenceProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [byUserId, setByUserId] =
    useState<ReadonlyMap<string, LeaguePresenceEntry>>(EMPTY_MAP);
  const [nflSeasonType, setNflSeasonType] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;

    const scheduleNext = (delayMs: number) => {
      if (cancelled) return;
      timeoutId = window.setTimeout(() => {
        void poll();
      }, delayMs);
    };

    const poll = async () => {
      if (document.visibilityState !== "visible") {
        scheduleNext(PRESENCE_POLL_INTERVAL_MS);
        return;
      }

      try {
        const response = await fetch(
          `/api/league/${encodeURIComponent(slug)}/presence`,
          { cache: "no-store" },
        );
        if (!response.ok || cancelled) {
          scheduleNext(PRESENCE_POLL_INTERVAL_MS);
          return;
        }

        const data = (await response.json()) as LeaguePresenceSnapshot;
        if (cancelled) return;

        setByUserId(toMap(data.members));
        setNflSeasonType(data.nflSeasonType);
      } catch {
        // Presence ages out on its own; ignore transient poll failures.
      }

      scheduleNext(PRESENCE_POLL_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timeoutId);
        void poll();
      }
    };

    scheduleNext(PRESENCE_INITIAL_DELAY_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [slug]);

  return (
    <LeaguePresenceContext.Provider value={{ byUserId, nflSeasonType }}>
      {children}
    </LeaguePresenceContext.Provider>
  );
}

/** Presence for a league member, or null outside a provider / unknown user. */
export function useLeaguePresence(
  userId: string | null | undefined,
): LeaguePresenceEntry | null {
  const ctx = useContext(LeaguePresenceContext);
  if (!ctx || !userId) return null;
  return ctx.byUserId.get(userId) ?? null;
}
