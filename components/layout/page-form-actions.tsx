import type { ReactNode } from "react";

import { FloatingActionBar } from "@/components/ui/floating-action-bar";

type PageFormActionsProps = {
  children: ReactNode;
  /**
   * When true, actions pin to a floating bottom bar (dirty forms / roster edits)
   * so users do not need to scroll to save.
   */
  float?: boolean;
};

/** Bottom-right action row for page-level save / reset / cancel buttons. */
export function PageFormActions({
  children,
  float = false,
}: PageFormActionsProps) {
  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-3">{children}</div>
  );

  if (!float) {
    return actions;
  }

  return (
    <>
      <div className="h-20 shrink-0" aria-hidden />
      <FloatingActionBar>
        <div className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
          {children}
        </div>
      </FloatingActionBar>
    </>
  );
}
