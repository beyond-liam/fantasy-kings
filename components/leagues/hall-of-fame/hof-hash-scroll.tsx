"use client";

import { useEffect } from "react";

/** Scroll to an in-page HoF section when the URL hash matches. */
export function HofHashScroll({ targetId }: { targetId: string }) {
  useEffect(() => {
    const scrollToTarget = () => {
      if (window.location.hash !== `#${targetId}`) return;
      const el = document.getElementById(targetId);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    scrollToTarget();
    window.addEventListener("hashchange", scrollToTarget);
    return () => window.removeEventListener("hashchange", scrollToTarget);
  }, [targetId]);

  return null;
}
