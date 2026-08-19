type CacheEntry<T> = {
  value: T;
  loadedAt: number;
};

export type ProcessCacheOptions = {
  ttlMs: number;
  maxEntries: number;
};

/** Cross-request in-process cache (works outside Next.js incremental cache). */
export function createProcessCache<T>(options: ProcessCacheOptions) {
  const store = new Map<string, CacheEntry<T>>();
  const inFlight = new Map<string, Promise<T>>();

  function evictOldest() {
    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, entry] of store) {
      if (entry.loadedAt < oldestAt) {
        oldestAt = entry.loadedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) store.delete(oldestKey);
  }

  return async function getCached(
    key: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    const hit = store.get(key);
    if (hit && Date.now() - hit.loadedAt < options.ttlMs) {
      return hit.value;
    }

    const pending = inFlight.get(key);
    if (pending) {
      return pending;
    }

    const promise = (async () => {
      try {
        const value = await loader();
        if (store.size >= options.maxEntries) {
          evictOldest();
        }
        store.set(key, { value, loadedAt: Date.now() });
        return value;
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, promise);
    return promise;
  };
}

export function createProcessCacheSync<T>(options: ProcessCacheOptions) {
  const store = new Map<string, CacheEntry<T>>();

  function evictOldest() {
    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, entry] of store) {
      if (entry.loadedAt < oldestAt) {
        oldestAt = entry.loadedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) store.delete(oldestKey);
  }

  return function getCached(key: string, loader: () => T): T {
    const hit = store.get(key);
    if (hit && Date.now() - hit.loadedAt < options.ttlMs) {
      return hit.value;
    }

    const value = loader();
    if (store.size >= options.maxEntries) {
      evictOldest();
    }
    store.set(key, { value, loadedAt: Date.now() });
    return value;
  };
}
