import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FloatingActionBarProps = {
  children: ReactNode;
  className?: string;
};

/** Fixed bottom bar for multi-step actions (trades, bulk edits). */
export function FloatingActionBar({
  children,
  className,
}: FloatingActionBarProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="pointer-events-auto flex w-full max-w-4xl items-center gap-4 rounded-xl border bg-background/95 p-3 shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm supports-backdrop-filter:bg-background/80">
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
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex min-w-0 items-center gap-2">{children}</div>
    </div>
  );
}
