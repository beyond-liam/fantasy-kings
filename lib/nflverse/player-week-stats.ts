/**
 * Map nflverse weekly player stats → Sleeper-shaped bags for `player_scores`.
 * Official post-week source (FG distance buckets, 2PT, etc.).
 */

export type NflversePlayerWeekRow = Record<string, string>;

function num(row: NflversePlayerWeekRow, key: string): number {
  const raw = row[key];
  if (raw == null || raw === "") {
    return 0;
  }
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function setIfPositive(bag: Record<string, number>, key: string, value: number) {
  if (value !== 0) {
    bag[key] = value;
  }
}

/**
 * Convert one nflverse week row into a Sleeper-compatible stats object.
 * Omits zero-only keys to keep the JSON small.
 */
export function nflverseRowToSleeperStats(
  row: NflversePlayerWeekRow,
): Record<string, number> {
  const bag: Record<string, number> = {};

  setIfPositive(bag, "pass_cmp", num(row, "completions"));
  setIfPositive(bag, "pass_att", num(row, "attempts"));
  setIfPositive(bag, "pass_yd", num(row, "passing_yards"));
  setIfPositive(bag, "pass_td", num(row, "passing_tds"));
  setIfPositive(bag, "pass_int", num(row, "passing_interceptions"));
  setIfPositive(bag, "pass_2pt", num(row, "passing_2pt_conversions"));

  setIfPositive(bag, "rush_att", num(row, "carries"));
  setIfPositive(bag, "rush_yd", num(row, "rushing_yards"));
  setIfPositive(bag, "rush_td", num(row, "rushing_tds"));
  setIfPositive(bag, "rush_2pt", num(row, "rushing_2pt_conversions"));

  setIfPositive(bag, "rec", num(row, "receptions"));
  setIfPositive(bag, "rec_tgt", num(row, "targets"));
  setIfPositive(bag, "rec_yd", num(row, "receiving_yards"));
  setIfPositive(bag, "rec_td", num(row, "receiving_tds"));
  setIfPositive(bag, "rec_2pt", num(row, "receiving_2pt_conversions"));

  const fumLost =
    num(row, "fumbles_lost_total") ||
    num(row, "rushing_fumbles_lost") +
      num(row, "receiving_fumbles_lost") +
      num(row, "sack_fumbles_lost");
  const fum =
    num(row, "fumbles_total") ||
    num(row, "rushing_fumbles") +
      num(row, "receiving_fumbles") +
      num(row, "sack_fumbles");
  setIfPositive(bag, "fum", fum);
  setIfPositive(bag, "fum_lost", fumLost);
  setIfPositive(bag, "fum_rec_td", num(row, "fumble_recovery_tds"));

  setIfPositive(bag, "fgm", num(row, "fg_made"));
  setIfPositive(bag, "fga", num(row, "fg_att"));
  setIfPositive(bag, "fgm_0_19", num(row, "fg_made_0_19"));
  setIfPositive(bag, "fgm_20_29", num(row, "fg_made_20_29"));
  setIfPositive(bag, "fgm_30_39", num(row, "fg_made_30_39"));
  setIfPositive(bag, "fgm_40_49", num(row, "fg_made_40_49"));
  setIfPositive(
    bag,
    "fgm_50p",
    num(row, "fg_made_50_59") + num(row, "fg_made_60_"),
  );

  setIfPositive(bag, "xpm", num(row, "pat_made"));
  setIfPositive(bag, "xpmiss", num(row, "pat_missed"));
  setIfPositive(bag, "xpa", num(row, "pat_att"));

  // Individual defenders (and any player credited with defense box-score lines).
  // Column names from nflverse stats_player_week; keys match Sleeper/scoring.
  setIfPositive(bag, "tkl_solo", num(row, "def_tackles_solo"));
  setIfPositive(bag, "tkl_ast", num(row, "def_tackle_assists"));
  setIfPositive(
    bag,
    "tkl",
    num(row, "def_tackles_solo") + num(row, "def_tackle_assists"),
  );
  setIfPositive(bag, "tkl_loss", num(row, "def_tackles_for_loss"));
  setIfPositive(bag, "sack", num(row, "def_sacks"));
  setIfPositive(bag, "ff", num(row, "def_fumbles_forced"));
  setIfPositive(bag, "fum_rec", num(row, "fumble_recovery_opp"));
  setIfPositive(bag, "int", num(row, "def_interceptions"));
  setIfPositive(bag, "safe", num(row, "def_safeties"));
  setIfPositive(bag, "def_td", num(row, "def_tds"));

  return bag;
}

/** Minimal CSV line parser (handles quoted fields). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

export function parseCsv(text: string): NflversePlayerWeekRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) {
    return [];
  }
  const headers = parseCsvLine(lines[0]);
  const rows: NflversePlayerWeekRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const row: NflversePlayerWeekRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cols[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

const PLAYERS_CSV_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv";

const WEEK_STATS_URL = (season: string) =>
  `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv.gz`;

/** Load gsis_id → espn_id from nflverse players release. */
export async function loadNflverseGsisToEspnMap(): Promise<Map<string, string>> {
  const response = await fetch(PLAYERS_CSV_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`nflverse players.csv failed: ${response.status}`);
  }
  const text = await response.text();
  const rows = parseCsv(text);
  const map = new Map<string, string>();
  for (const row of rows) {
    const gsis = row.gsis_id?.trim();
    const espn = row.espn_id?.trim();
    if (gsis && espn) {
      map.set(gsis, espn);
    }
  }
  return map;
}

export type NflverseWeekStatLine = {
  gsisId: string;
  espnId: string | null;
  displayName: string;
  week: number;
  seasonType: string;
  stats: Record<string, number>;
};

/**
 * Fetch nflverse week stats for one season and filter to a week + REG.
 * Decompresses .csv.gz via DecompressionStream when available.
 */
export async function fetchNflverseWeekStatLines(input: {
  season: string;
  week: number;
  gsisToEspn?: Map<string, string>;
}): Promise<NflverseWeekStatLine[]> {
  const response = await fetch(WEEK_STATS_URL(input.season), {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `nflverse week stats failed for ${input.season}: ${response.status}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const { gunzipSync } = await import("node:zlib");
  const text = gunzipSync(buffer).toString("utf8");
  const rows = parseCsv(text);
  const gsisToEspn = input.gsisToEspn ?? (await loadNflverseGsisToEspnMap());

  const lines: NflverseWeekStatLine[] = [];
  for (const row of rows) {
    const week = Number.parseInt(row.week ?? "", 10);
    if (week !== input.week) {
      continue;
    }
    const seasonType = (row.season_type ?? "REG").toUpperCase();
    if (seasonType !== "REG") {
      continue;
    }
    const gsisId = row.player_id?.trim();
    if (!gsisId) {
      continue;
    }
    const stats = nflverseRowToSleeperStats(row);
    if (Object.keys(stats).length === 0) {
      continue;
    }
    lines.push({
      gsisId,
      espnId: gsisToEspn.get(gsisId) ?? null,
      displayName: row.player_display_name?.trim() || row.player_name || gsisId,
      week,
      seasonType,
      stats,
    });
  }

  return lines;
}
