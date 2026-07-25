"use client";

import type { ReactNode } from "react";

import { FloatingActionBar } from "@/components/ui/floating-action-bar";

type PageFormActionsProps = {
  children: ReactNode;
  /**
   * When set (including `false`), actions only appear in the floating bar —
   * never in a card/page footer. Pass the dirty flag, e.g. `float={hasChanges}`.
   * Omit for a normal in-flow action row.
   */
  float?: boolean;
};

/**
 * Page-level save / reset / cancel actions.
 * With `float`, buttons only show in the animated floating bar while dirty.
 */
export function PageFormActions({ children, float }: PageFormActionsProps) {
  if (float === undefined) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        {children}
      </div>
    );
  }

  return (
    <FloatingActionBar open={float}>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {children}
      </div>
    </FloatingActionBar>
  );
}
