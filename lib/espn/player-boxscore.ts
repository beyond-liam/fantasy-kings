/**
 * ESPN game summary → per-athlete boxscore stats in Sleeper-shaped keys.
 * Used for mid-game / near-final live scoring (nflverse remains post-week official).
 */

const ESPN_SUMMARY =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary";

/** Categories we map into fantasy-relevant Sleeper stat keys. */
const FANTASY_CATEGORIES = new Set([
  "passing",
  "rushing",
  "receiving",
  "fumbles",
  "kicking",
  "kickReturns",
  "puntReturns",
  "interceptions",
  "defensive",
]);

type EspnAthleteRef = {
  id?: string;
  displayName?: string;
};

type EspnAthleteRow = {
  athlete?: EspnAthleteRef;
  stats?: string[];
};

type EspnStatCategory = {
  name?: string;
  keys?: string[];
  athletes?: EspnAthleteRow[];
};

type EspnPlayerSide = {
  team?: { abbreviation?: string; id?: string };
  statistics?: EspnStatCategory[];
};

type EspnSummaryBoxscore = {
  boxscore?: {
    players?: EspnPlayerSide[];
  };
};

export type EspnAthleteStatLine = {
  espnAthleteId: string;
  displayName: string | null;
  teamAbbreviation: string | null;
  stats: Record<string, number>;
};

function parseNumber(raw: string | undefined): number | null {
  if (raw == null || raw === "" || raw === "-") {
    return null;
  }
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Parse "21/34" or "1-2" compound display values. */
function parsePair(raw: string | undefined): [number | null, number | null] {
  if (raw == null || raw === "" || raw === "-") {
    return [null, null];
  }
  const parts = raw.split(/[/-]/);
  if (parts.length < 2) {
    return [parseNumber(raw), null];
  }
  return [parseNumber(parts[0]), parseNumber(parts[1])];
}

function setStat(
  bag: Record<string, number>,
  key: string,
  value: number | null,
) {
  if (value == null) {
    return;
  }
  bag[key] = (bag[key] ?? 0) + value;
}

/**
 * Map one ESPN category row onto a Sleeper-shaped stats bag (additive merge).
 */
export function applyEspnCategoryStats(
  bag: Record<string, number>,
  categoryName: string,
  keys: string[],
  stats: string[],
): void {
  const byKey = new Map<string, string>();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = stats[i];
    if (key != null && value != null) {
      byKey.set(key, value);
    }
  }

  switch (categoryName) {
    case "passing": {
      const [cmp, att] = parsePair(byKey.get("completions/passingAttempts"));
      setStat(bag, "pass_cmp", cmp);
      setStat(bag, "pass_att", att);
      setStat(bag, "pass_yd", parseNumber(byKey.get("passingYards")));
      setStat(bag, "pass_td", parseNumber(byKey.get("passingTouchdowns")));
      setStat(bag, "pass_int", parseNumber(byKey.get("interceptions")));
      break;
    }
    case "rushing": {
      setStat(bag, "rush_att", parseNumber(byKey.get("rushingAttempts")));
      setStat(bag, "rush_yd", parseNumber(byKey.get("rushingYards")));
      setStat(bag, "rush_td", parseNumber(byKey.get("rushingTouchdowns")));
      break;
    }
    case "receiving": {
      setStat(bag, "rec", parseNumber(byKey.get("receptions")));
      setStat(bag, "rec_yd", parseNumber(byKey.get("receivingYards")));
      setStat(bag, "rec_td", parseNumber(byKey.get("receivingTouchdowns")));
      setStat(bag, "rec_tgt", parseNumber(byKey.get("receivingTargets")));
      break;
    }
    case "fumbles": {
      setStat(bag, "fum", parseNumber(byKey.get("fumbles")));
      setStat(bag, "fum_lost", parseNumber(byKey.get("fumblesLost")));
      break;
    }
    case "kicking": {
      const [fgm, fga] = parsePair(
        byKey.get("fieldGoalsMade/fieldGoalAttempts"),
      );
      setStat(bag, "fgm", fgm);
      setStat(bag, "fga", fga);
      const [xpm, xpa] = parsePair(
        byKey.get("extraPointsMade/extraPointAttempts"),
      );
      setStat(bag, "xpm", xpm);
      setStat(bag, "xpa", xpa);
      break;
    }
    case "kickReturns": {
      setStat(
        bag,
        "def_kr_td",
        parseNumber(byKey.get("kickReturnTouchdowns")),
      );
      break;
    }
    case "puntReturns": {
      setStat(bag, "pr_td", parseNumber(byKey.get("puntReturnTouchdowns")));
      break;
    }
    case "interceptions": {
      setStat(bag, "int", parseNumber(byKey.get("interceptions")));
      setStat(
        bag,
        "def_td",
        parseNumber(byKey.get("interceptionTouchdowns")),
      );
      break;
    }
    case "defensive": {
      setStat(bag, "tkl_solo", parseNumber(byKey.get("soloTackles")));
      setStat(bag, "sack", parseNumber(byKey.get("sacks")));
      setStat(
        bag,
        "def_td",
        parseNumber(byKey.get("defensiveTouchdowns")),
      );
      break;
    }
    default:
      break;
  }
}

/** Parse `boxscore.players` from an ESPN summary payload into athlete lines. */
export function parseEspnPlayerBoxscore(
  payload: EspnSummaryBoxscore,
): EspnAthleteStatLine[] {
  const byAthlete = new Map<string, EspnAthleteStatLine>();

  for (const side of payload.boxscore?.players ?? []) {
    const teamAbbreviation = side.team?.abbreviation ?? null;
    for (const category of side.statistics ?? []) {
      const name = category.name;
      if (!name || !FANTASY_CATEGORIES.has(name)) {
        continue;
      }
      const keys = category.keys ?? [];
      for (const row of category.athletes ?? []) {
        const espnAthleteId = row.athlete?.id?.trim();
        if (!espnAthleteId) {
          continue;
        }
        let line = byAthlete.get(espnAthleteId);
        if (!line) {
          line = {
            espnAthleteId,
            displayName: row.athlete?.displayName?.trim() || null,
            teamAbbreviation,
            stats: {},
          };
          byAthlete.set(espnAthleteId, line);
        }
        applyEspnCategoryStats(line.stats, name, keys, row.stats ?? []);
      }
    }
  }

  return [...byAthlete.values()].filter(
    (line) => Object.keys(line.stats).length > 0,
  );
}

export async function fetchEspnPlayerBoxscore(
  eventId: string,
): Promise<EspnAthleteStatLine[]> {
  const url = new URL(ESPN_SUMMARY);
  url.searchParams.set("event", eventId);

  const response = await fetch(url.toString(), {
    next: { revalidate: 30 },
  });
  if (!response.ok) {
    throw new Error(
      `ESPN summary failed for event ${eventId}: ${response.status}`,
    );
  }

  const payload = (await response.json()) as EspnSummaryBoxscore;
  return parseEspnPlayerBoxscore(payload);
}
