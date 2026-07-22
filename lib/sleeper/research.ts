import { cache } from "react";

import { getNflState } from "@/lib/sleeper/api";

const SLEEPER_COM_BASE = "https://api.sleeper.com";

export type SleeperResearchRates = {
  ownedPct: number | null;
  startPct: number | null;
};

type SleeperResearchRow = {
  owned?: number | null;
  started?: number | null;
};

function toPct(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

/**
 * Platform-wide ownership / start rates from Sleeper research.
 * Keys are Sleeper player IDs.
 */
export const getSleeperResearchRatesMap = cache(
  async (input?: {
    season?: string;
    week?: number | null;
  }): Promise<Map<string, SleeperResearchRates>> => {
    const state = await getNflState();
    const season = input?.season ?? state.season;
    const week =
      input?.week === undefined
        ? (state.display_week ?? state.week)
        : input.week;

    const path =
      week == null
        ? `${SLEEPER_COM_BASE}/players/nfl/research/regular/${season}`
        : `${SLEEPER_COM_BASE}/players/nfl/research/regular/${season}/${week}`;

    const response = await fetch(path, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Sleeper research failed: ${response.status}`);
    }

    const payload = (await response.json()) as Record<
      string,
      SleeperResearchRow
    >;

    const map = new Map<string, SleeperResearchRates>();
    for (const [sleeperId, row] of Object.entries(payload)) {
      map.set(sleeperId, {
        ownedPct: toPct(row.owned),
        startPct: toPct(row.started),
      });
    }
    return map;
  },
);

export async function getSleeperResearchRatesForPlayer(
  sleeperId: string | null | undefined,
  input?: { season?: string; week?: number | null },
): Promise<SleeperResearchRates> {
  if (!sleeperId) {
    return { ownedPct: null, startPct: null };
  }
  const map = await getSleeperResearchRatesMap(input).catch(
    () => new Map<string, SleeperResearchRates>(),
  );
  return map.get(sleeperId) ?? { ownedPct: null, startPct: null };
}
