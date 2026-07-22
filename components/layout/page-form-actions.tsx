import type { ReactNode } from "react";

type PageFormActionsProps = {
  children: ReactNode;
};

/** Bottom-right action row for page-level save / reset / cancel buttons. */
export function PageFormActions({ children }: PageFormActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {children}
    </div>
  );
}
