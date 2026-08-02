"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Bookmark02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { useOptionalWatchlistStore } from "@/components/rankings/watchlist-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => {};

type PlayerWatchlistButtonProps = {
  playerId: string;
  leagueSlug: string;
  initialWatched: boolean;
  className?: string;
};

export function PlayerWatchlistButton({
  playerId,
  leagueSlug,
  initialWatched,
  className,
}: PlayerWatchlistButtonProps) {
  const store = useOptionalWatchlistStore();
  const [localWatched, setLocalWatched] = useState(initialWatched);
  const [pending, startTransition] = useTransition();
  const storeWatched = useSyncExternalStore(
    store?.subscribe ?? subscribeNoop,
    () => store?.getSnapshot().has(playerId) ?? false,
    () => store?.getSnapshot().has(playerId) ?? false,
  );

  const watched = store ? storeWatched : localWatched;
  const label = watched ? "Remove from watchlist" : "Add to watchlist";

  const handleToggle = () => {
    if (store) {
      store.toggle(playerId);
      return;
    }

    const wasWatched = localWatched;
    setLocalWatched(!wasWatched);
    startTransition(async () => {
      try {
        const response = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: leagueSlug, playerId }),
        });
        const result = (await response.json()) as {
          success?: boolean;
          watched?: boolean;
        };
        if (!response.ok || !result.success) {
          setLocalWatched(wasWatched);
          return;
        }
        if (typeof result.watched === "boolean") {
          setLocalWatched(result.watched);
        }
      } catch {
        setLocalWatched(wasWatched);
      }
    });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={cn(
                pending ? "inline-flex cursor-not-allowed" : "inline-flex",
                className,
              )}
            />
          }
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={label}
            disabled={pending}
            onClick={handleToggle}
          >
            <HugeiconsIcon
              icon={Bookmark02Icon}
              strokeWidth={2}
              className={cn(
                watched && "fill-warning stroke-warning text-warning",
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
