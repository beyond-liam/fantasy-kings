import {
  parseEspnPlayerBoxscore,
  type EspnSummaryPayload,
} from "@/lib/espn/player-boxscore";
import { normalizeNflTeamAbbrev } from "@/lib/nfl/matchups";

export type EspnTeamDefStatLine = {
  teamAbbreviation: string;
  stats: Record<string, number>;
};

const TEAM_DEF_COUNT_KEYS = [
  "sack",
  "int",
  "ff",
  "fum_rec",
  "def_td",
  "safe",
  "tkl_solo",
  "tkl_ast",
  "tkl",
  "tkl_loss",
  "pass_def",
  "qb_hit",
  "def_kr_td",
  "pr_td",
] as const;

function parseNumber(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") {
    return null;
  }
  const n =
    typeof raw === "number"
      ? raw
      : Number.parseFloat(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseLeadingCount(raw: string | undefined): number | null {
  if (raw == null || raw === "" || raw === "-") {
    return null;
  }
  const [left] = raw.split(/[/-]/);
  return parseNumber(left);
}

function setIfPresent(
  bag: Record<string, number>,
  key: string,
  value: number | null,
) {
  if (value == null) {
    return;
  }
  bag[key] = value;
}

function teamStatMap(
  payload: EspnSummaryPayload,
  abbrev: string,
): Map<string, string> {
  const teams = payload.boxscore?.teams ?? [];
  const team = teams.find(
    (row) =>
      normalizeNflTeamAbbrev(row.team?.abbreviation) === abbrev,
  );
  return new Map(
    (team?.statistics ?? []).flatMap((stat) =>
      stat.name ? [[stat.name, stat.displayValue ?? ""]] : [],
    ),
  );
}

function sumAthleteDefStats(
  payload: EspnSummaryPayload,
  teamAbbrev: string,
): Record<string, number> {
  const summed: Record<string, number> = {};
  for (const line of parseEspnPlayerBoxscore(payload)) {
    if (normalizeNflTeamAbbrev(line.teamAbbreviation) !== teamAbbrev) {
      continue;
    }
    for (const key of TEAM_DEF_COUNT_KEYS) {
      const value = line.stats[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        summed[key] = (summed[key] ?? 0) + value;
      }
    }
  }
  return summed;
}

function countSafeties(
  payload: EspnSummaryPayload,
  teamAbbrev: string,
): number {
  let count = 0;
  for (const play of payload.scoringPlays ?? []) {
    if (!/safety/i.test(play.text ?? "")) {
      continue;
    }
    if (normalizeNflTeamAbbrev(play.team?.abbreviation) === teamAbbrev) {
      count += 1;
    }
  }
  return count;
}

type Side = {
  abbrev: string;
  score: number | null;
};

function parseSides(payload: EspnSummaryPayload): Side[] {
  const competitors =
    payload.header?.competitions?.[0]?.competitors ?? [];
  const sides: Side[] = [];
  for (const competitor of competitors) {
    const abbrev = normalizeNflTeamAbbrev(competitor.team?.abbreviation);
    if (!abbrev) {
      continue;
    }
    sides.push({
      abbrev,
      score: parseNumber(competitor.score),
    });
  }
  return sides;
}

/**
 * Team DEF is not an ESPN athlete. Build Sleeper-shaped DEF bags from the
 * same summary used for player boxscores: opponent score + defensive totals.
 */
export function parseEspnTeamDefBoxscore(
  payload: EspnSummaryPayload,
): EspnTeamDefStatLine[] {
  const sides = parseSides(payload);
  if (sides.length < 2) {
    return [];
  }

  const lines: EspnTeamDefStatLine[] = [];
  for (const side of sides) {
    const opponent = sides.find((other) => other.abbrev !== side.abbrev);
    if (!opponent) {
      continue;
    }

    const bag: Record<string, number> = {
      ...sumAthleteDefStats(payload, side.abbrev),
    };
    const ourTeam = teamStatMap(payload, side.abbrev);
    const theirTeam = teamStatMap(payload, opponent.abbrev);

    if (bag.sack == null || bag.sack === 0) {
      setIfPresent(bag, "sack", parseLeadingCount(theirTeam.get("sacksYardsLost")));
    }
    if (bag.int == null || bag.int === 0) {
      setIfPresent(
        bag,
        "int",
        parseNumber(ourTeam.get("defensiveInterceptions")) ??
          parseNumber(theirTeam.get("interceptions")) ??
          parseNumber(theirTeam.get("interceptionsThrown")),
      );
    }
    if (bag.fum_rec == null || bag.fum_rec === 0) {
      setIfPresent(bag, "fum_rec", parseNumber(theirTeam.get("fumblesLost")));
    }
    if (bag.safe == null || bag.safe === 0) {
      const safeties = countSafeties(payload, side.abbrev);
      if (safeties > 0) {
        bag.safe = safeties;
      }
    }

    if (opponent.score != null) {
      bag.pts_allow = opponent.score;
      if (opponent.score === 0) {
        bag.pts_allow_0 = 1;
      }
    }

    if (Object.keys(bag).length === 0) {
      continue;
    }

    lines.push({ teamAbbreviation: side.abbrev, stats: bag });
  }

  return lines;
}
