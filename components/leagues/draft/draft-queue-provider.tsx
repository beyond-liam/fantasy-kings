"use client";

import {
  createContext,
  useContext,
  useMemo,
  useOptimistic,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { toggleDraftQueue } from "@/lib/actions/draft";

type DraftQueueContextValue = {
  queuedIds: Set<string>;
  toggle: (playerId: string) => void;
};

const DraftQueueContext = createContext<DraftQueueContextValue | null>(null);

export function DraftQueueProvider({
  slug,
  initialQueuedIds,
  children,
}: {
  slug: string;
  initialQueuedIds: string[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const baseline = useMemo(
    () => new Set(initialQueuedIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on membership change
    [initialQueuedIds.join(",")],
  );
  const [queuedIds, setQueuedIds] = useOptimistic(
    baseline,
    (current, playerId: string) => {
      const next = new Set(current);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    },
  );

  const toggle = (playerId: string) => {
    startTransition(async () => {
      setQueuedIds(playerId);
      const result = await toggleDraftQueue(slug, playerId);
      if (!result.success) {
        toast.error(result.error ?? "Could not update queue.");
        router.refresh();
        return;
      }
      router.refresh();
    });
  };

  return (
    <DraftQueueContext.Provider value={{ queuedIds, toggle }}>
      {children}
    </DraftQueueContext.Provider>
  );
}

export function useIsQueued(playerId: string) {
  const ctx = useContext(DraftQueueContext);
  return ctx?.queuedIds.has(playerId) ?? false;
}

export function useToggleDraftQueue() {
  const ctx = useContext(DraftQueueContext);
  if (!ctx) {
    throw new Error("useToggleDraftQueue requires DraftQueueProvider");
  }
  return ctx.toggle;
}
