const EMPTY_CELL = "-";

type EspnBoxAthlete = {
  id?: string;
  displayName?: string;
  jersey?: string;
};

type EspnBoxCategory = {
  name?: string;
  text?: string;
  labels?: string[];
  descriptions?: string[];
  totals?: string[];
  athletes?: Array<{
    athlete?: EspnBoxAthlete;
    stats?: string[];
  }>;
};

export type EspnBoxScorePlayersPayload = {
  boxscore?: {
    players?: Array<{
      team?: {
        abbreviation?: string;
        displayName?: string;
        name?: string;
      };
      statistics?: EspnBoxCategory[];
    }>;
  };
};

export type GameBoxScorePlayerRow = {
  id: string;
  name: string;
  stats: string[];
};

export type GameBoxScoreColumn = {
  label: string;
  description: string | null;
};

export type GameBoxScoreCategory = {
  name: string;
  title: string;
  columns: GameBoxScoreColumn[];
  rows: GameBoxScorePlayerRow[];
  totals: string[] | null;
};

export type GameBoxScoreSide = {
  abbreviation: string;
  categories: GameBoxScoreCategory[];
};

export type GameBoxScore = {
  away: GameBoxScoreSide;
  home: GameBoxScoreSide;
};

function padCells(values: string[] | undefined, count: number): string[] {
  const cells = (values ?? [])
    .slice(0, count)
    .map((value) => value?.trim() || EMPTY_CELL);
  while (cells.length < count) {
    cells.push(EMPTY_CELL);
  }
  return cells;
}

function hasValues(cells: string[]): boolean {
  return cells.some((cell) => cell !== EMPTY_CELL);
}

function parseCategory(category: EspnBoxCategory): GameBoxScoreCategory | null {
  const labels = (category.labels ?? [])
    .map((label) => label.trim())
    .filter(Boolean);
  if (labels.length === 0) return null;

  const columns: GameBoxScoreColumn[] = labels.map((label, index) => ({
    label,
    description: category.descriptions?.[index]?.trim() || null,
  }));
  const name = category.name?.trim() || "stats";
  const title = category.text?.trim() || name;
  const rows: GameBoxScorePlayerRow[] = [];

  for (const row of category.athletes ?? []) {
    const id = row.athlete?.id?.trim();
    const playerName = row.athlete?.displayName?.trim();
    if (!id || !playerName) continue;
    const stats = padCells(row.stats, labels.length);
    if (!hasValues(stats)) continue;
    rows.push({ id, name: playerName, stats });
  }

  const totals = padCells(category.totals, labels.length);

  return {
    name,
    title,
    columns,
    rows,
    totals: hasValues(totals) ? totals : null,
  };
}

function parseSide(
  side: NonNullable<
    NonNullable<EspnBoxScorePlayersPayload["boxscore"]>["players"]
  >[number],
): GameBoxScoreSide | null {
  const abbreviation = side.team?.abbreviation?.trim().toUpperCase();
  if (!abbreviation) return null;

  const categories = (side.statistics ?? [])
    .map(parseCategory)
    .filter((category): category is GameBoxScoreCategory => category != null);

  return { abbreviation, categories };
}

export function parseGameBoxScore(
  payload: EspnBoxScorePlayersPayload,
  awayAbbrev: string,
  homeAbbrev: string,
): GameBoxScore | null {
  const sides = payload.boxscore?.players ?? [];
  if (sides.length === 0) return null;

  const parsed = sides
    .map(parseSide)
    .filter((side): side is GameBoxScoreSide => side != null);

  const away =
    parsed.find((side) => side.abbreviation === awayAbbrev.toUpperCase()) ??
    null;
  const home =
    parsed.find((side) => side.abbreviation === homeAbbrev.toUpperCase()) ??
    null;

  if (!away && !home) return null;

  return {
    away: away ?? { abbreviation: awayAbbrev.toUpperCase(), categories: [] },
    home: home ?? { abbreviation: homeAbbrev.toUpperCase(), categories: [] },
  };
}
