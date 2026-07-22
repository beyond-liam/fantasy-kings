"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type WatchlistStore = {
  getSnapshot: () => Set<string>;
  subscribe: (listener: () => void) => () => void;
  toggle: (playerId: string) => void;
};

const WatchlistStoreContext = createContext<WatchlistStore | null>(null);

type WatchlistProviderProps = {
  children: ReactNode;
  leagueSlug: string;
  initialPlayerIds: string[];
};

export function WatchlistProvider({
  children,
  leagueSlug,
  initialPlayerIds,
}: WatchlistProviderProps) {
  const idsRef = useRef(new Set(initialPlayerIds));
  const listenersRef = useRef(new Set<() => void>());

  const store = useMemo<WatchlistStore>(() => {
    const emit = () => {
      for (const listener of listenersRef.current) {
        listener();
      }
    };

    return {
      getSnapshot: () => idsRef.current,
      subscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
      toggle: (playerId: string) => {
        const wasWatched = idsRef.current.has(playerId);
        const next = new Set(idsRef.current);
        if (wasWatched) {
          next.delete(playerId);
        } else {
          next.add(playerId);
        }
        idsRef.current = next;
        emit();

        void fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: leagueSlug, playerId }),
        })
          .then(async (response) => {
            const result = (await response.json()) as {
              success?: boolean;
            };
            if (!response.ok || !result.success) {
              throw new Error("Watchlist update failed");
            }
          })
          .catch(() => {
            const rolledBack = new Set(idsRef.current);
            if (wasWatched) {
              rolledBack.add(playerId);
            } else {
              rolledBack.delete(playerId);
            }
            idsRef.current = rolledBack;
            emit();
          });
      },
    };
  }, [leagueSlug]);

  return (
    <WatchlistStoreContext.Provider value={store}>
      {children}
    </WatchlistStoreContext.Provider>
  );
}

function useWatchlistStore() {
  const store = useContext(WatchlistStoreContext);
  if (!store) {
    throw new Error("useWatchlist must be used within WatchlistProvider");
  }
  return store;
}

export function useWatchlist() {
  const store = useWatchlistStore();
  const ids = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  const isWatched = useCallback(
    (playerId: string) => ids.has(playerId),
    [ids],
  );

  return {
    isWatched,
    toggle: store.toggle,
  };
}

/** Subscribes only to one player's watched state — avoids table-wide re-renders. */
export function useIsWatched(playerId: string) {
  const store = useWatchlistStore();

  return useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().has(playerId),
    () => store.getSnapshot().has(playerId),
  );
}

export function useToggleWatchlist() {
  return useWatchlistStore().toggle;
}
