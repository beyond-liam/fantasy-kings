const SLEEPER_APP_BASE = "https://api.sleeper.app/v1";
const SLEEPER_COM_BASE = "https://api.sleeper.com";

export const SCORE_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

export type SleeperNflState = {
  season: string;
  previous_season: string;
  season_type: string;
  week: number;
  display_week: number;
};

export type SleeperScoreRow = {
  player_id: string;
  season?: string;
  week?: number;
  season_type?: string;
  category?: string;
  stats?: Record<string, number | null>;
  player?: {
    position?: string | null;
    team?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    years_exp?: number | null;
    fantasy_positions?: string[] | null;
    metadata?: { rookie_year?: string | null } | null;
  };
};

export async function getNflState(options?: {
  /** Bypass Next fetch cache (cron / ingest). */
  fresh?: boolean;
}): Promise<SleeperNflState> {
  const response = await fetch(`${SLEEPER_APP_BASE}/state/nfl`, {
    ...(options?.fresh
      ? { cache: "no-store" as const }
      : { next: { revalidate: 3600 } }),
  });
  if (!response.ok) {
    throw new Error(`Sleeper state failed: ${response.status}`);
  }
  return response.json();
}

function scorePath(kind: "projection" | "stats", season: string, week: number | null) {
  const segment = kind === "projection" ? "projections" : "stats";
  return week === null
    ? `${segment}/nfl/${season}`
    : `${segment}/nfl/${season}/${week}`;
}

function buildScoreUrl(
  kind: "projection" | "stats",
  season: string,
  week: number | null,
) {
  const path = scorePath(kind, season, week);
  const params = new URLSearchParams({
    season_type: "regular",
    order_by: "pts_ppr",
  });

  for (const position of SCORE_POSITIONS) {
    params.append("position[]", position);
  }

  return `${SLEEPER_COM_BASE}/${path}?${params.toString()}`;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchSleeperScores(
  kind: "projection" | "stats",
  season: string,
  week: number | null,
): Promise<SleeperScoreRow[]> {
  const url = buildScoreUrl(kind, season, week);
  const weekLabel = week === null ? "season" : `w${week}`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url, { cache: "no-store" });

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }

    lastError = new Error(
      `Sleeper ${kind} failed (${season} ${weekLabel}): ${response.status}`,
    );

    if (attempt < 3) {
      await sleep(attempt * 2000);
    }
  }

  throw lastError!;
}
