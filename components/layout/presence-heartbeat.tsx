"use client";

import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 75_000;
/** Let the initial RSC finish before competing for the single DB connection. */
const HEARTBEAT_INITIAL_DELAY_MS = 2_500;

/** Keeps `profiles.last_seen_at` warm while this tab is visible. */
export function PresenceHeartbeat() {
  useEffect(() => {
    let cancelled = false;
    let intervalId = 0;
    let initialTimeoutId = 0;

    const send = () => {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }
      void fetch("/api/presence/heartbeat", {
        method: "POST",
        cache: "no-store",
        keepalive: true,
      }).catch(() => {
        // Presence expires on its own; transient failures need no handling.
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        send();
      }
    };

    initialTimeoutId = window.setTimeout(send, HEARTBEAT_INITIAL_DELAY_MS);
    intervalId = window.setInterval(send, HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimeoutId);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
