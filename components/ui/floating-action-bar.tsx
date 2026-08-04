"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Keep in sync with fab-motion animation duration in globals.css */
const FAB_MOTION_MS = 280;

type FloatingActionBarProps = {
  children: ReactNode;
  className?: string;
  /** When false, fades out and unmounts. Defaults to true. */
  open?: boolean;
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Fixed bottom bar that wraps its children (centered, intrinsic width). */
export function FloatingActionBar({
  children,
  className,
  open = true,
}: FloatingActionBarProps) {
  const [rendered, setRendered] = useState(open);
  const [phase, setPhase] = useState<"in" | "out">(open ? "in" : "out");

  // Sync enter/exit phase from `open` during render (avoids setState-in-effect).
  if (open) {
    if (!rendered || phase !== "in") {
      setRendered(true);
      setPhase("in");
    }
  } else if (rendered && phase === "in") {
    // Reduced motion: unmount immediately. Otherwise exit animation, then effect.
    if (prefersReducedMotion()) {
      setRendered(false);
      setPhase("out");
    } else {
      setPhase("out");
    }
  }

  useEffect(() => {
    if (open || phase !== "out" || !rendered) return;
    const timeout = window.setTimeout(() => setRendered(false), FAB_MOTION_MS);
    return () => window.clearTimeout(timeout);
  }, [open, phase, rendered]);

  if (!rendered) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        data-slot="floating-action-bar"
        className={cn(
          "pointer-events-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border bg-background/95 p-3 shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm supports-backdrop-filter:bg-background/80",
          phase === "in" ? "fab-motion-in" : "fab-motion-out",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

type FloatingActionBarSectionProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function FloatingActionBarSection({
  label,
  children,
  className,
}: FloatingActionBarSectionProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex min-w-0 items-center gap-2">{children}</div>
    </div>
  );
}
