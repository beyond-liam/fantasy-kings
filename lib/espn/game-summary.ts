import { getSleeperTeamLogoUrl } from "@/lib/sleeper/avatars";
import type { ScheduleGame, ScheduleTeam } from "@/lib/espn/scoreboard";

const ESPN_SUMMARY =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary";

/** Shown when a field or section could not be loaded / parsed. */
export const MISSING_VALUE = "-";

type EspnTeamRef = {
  id?: string;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  name?: string;
  location?: string;
  logo?: string;
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string | number | null;
  winner?: boolean | null;
  record?: Array<{ type?: string; summary?: string; displayValue?: string }>;
  records?: Array<{ type?: string; name?: string; summary?: string }>;
  linescores?: Array<{ displayValue?: string; value?: number }>;
  team?: EspnTeamRef;
};

type EspnHeaderCompetition = {
  date?: string;
  status?: {
    type?: {
      state?: string;
      completed?: boolean;
      description?: string;
      shortDetail?: string;
    };
    displayClock?: string;
    period?: number;
  };
  broadcasts?: Array<{
    media?: { shortName?: string };
    names?: string[];
  }>;
  competitors?: EspnCompetitor[];
};

type EspnSummaryResponse = {
  header?: {
    id?: string;
    competitions?: EspnHeaderCompetition[];
  };
  gameInfo?: {
    venue?: {
      fullName?: string;
      address?: { city?: string; state?: string };
    };
  };
  predictor?: {
    homeTeam?: { gameProjection?: string };
    awayTeam?: { gameProjection?: string };
  };
  pickcenter?: Array<{
    details?: string;
    overUnder?: number;
    spread?: number;
    pointSpread?: {
      home?: {
        open?: { line?: string; odds?: string };
        close?: { line?: string; odds?: string };
      };
      away?: {
        open?: { line?: string; odds?: string };
        close?: { line?: string; odds?: string };
      };
    };
    total?: {
      over?: {
        open?: { line?: string; odds?: string };
        close?: { line?: string; odds?: string };
      };
      under?: {
        open?: { line?: string; odds?: string };
        close?: { line?: string; odds?: string };
      };
    };
    moneyline?: {
      home?: {
        open?: { odds?: string };
        close?: { odds?: string };
      };
      away?: {
        open?: { odds?: string };
        close?: { odds?: string };
      };
    };
    awayTeamOdds?: { moneyLine?: number; spreadOdds?: number };
    homeTeamOdds?: { moneyLine?: number; spreadOdds?: number };
    provider?: { name?: string };
  }>;
  leaders?: Array<{
    team?: EspnTeamRef;
    leaders?: Array<{
      name?: string;
      displayName?: string;
      leaders?: Array<{
        displayValue?: string;
        athlete?: {
          displayName?: string;
          shortName?: string;
          position?: { abbreviation?: string };
        };
      }>;
    }>;
  }>;
  injuries?: Array<{
    team?: EspnTeamRef;
    injuries?: Array<{
      status?: string;
      athlete?: {
        displayName?: string;
        position?: { abbreviation?: string };
      };
      details?: {
        returnDate?: string;
        fantasyStatus?: { abbreviation?: string; description?: string };
      };
      type?: { abbreviation?: string; description?: string };
    }>;
  }>;
  lastFiveGames?: Array<{
    team?: EspnTeamRef;
    events?: Array<{
      gameDate?: string;
      atVs?: string;
      score?: string;
      gameResult?: string;
      opponent?: EspnTeamRef;
    }>;
  }>;
  standings?: {
    header?: string;
    groups?: Array<{
      header?: string;
      divisionHeader?: string;
      standings?: {
        entries?: Array<{
          team?: string | EspnTeamRef;
          stats?: Array<{
            name?: string;
            abbreviation?: string;
            displayValue?: string;
            value?: number | null;
          }>;
          logo?: Array<{ href?: string }>;
        }>;
      };
    }>;
  };
  boxscore?: {
    teams?: Array<{
      homeAway?: string;
      team?: EspnTeamRef;
      statistics?: Array<{
        name?: string;
        label?: string;
        displayValue?: string;
      }>;
    }>;
  };
  scoringPlays?: Array<{
    text?: string;
    awayScore?: number;
    homeScore?: number;
    period?: { number?: number };
    team?: EspnTeamRef;
  }>;
  drives?: {
    previous?: Array<{
      plays?: Array<{
        text?: string;
        scoringPlay?: boolean;
        awayScore?: number;
        homeScore?: number;
        period?: { number?: number };
        team?: EspnTeamRef;
        teamParticipants?: Array<{ team?: { $ref?: string } }>;
      }>;
      team?: EspnTeamRef;
    }>;
  };
  winprobability?: Array<{
    homeWinPercentage?: number;
    playId?: string;
  }>;
};

export type GameLeaderSide = {
  name: string;
  position: string;
  line: string;
};

export type GameLeaderCategory = {
  category: string;
  away: GameLeaderSide;
  home: GameLeaderSide;
};

export type InjuryRow = {
  name: string;
  position: string;
  status: string;
  estReturn: string;
  side: "away" | "home";
};

export type FormGame = {
  date: string;
  opponent: string;
  opponentAbbrev: string;
  result: "W" | "L" | "T" | string;
  score: string;
};

export type StandingRow = {
  abbrev: string;
  name: string;
  w: number | string;
  l: number | string;
  t: number | string;
  pct: string;
  pf: number | string;
  pa: number | string;
  highlight: boolean;
};

export type DivisionStanding = {
  name: string;
  rows: StandingRow[];
};

export type GameOddsSide = {
  open: string;
  spread: string;
  total: string;
  moneyline: string;
};

export type GameOdds = {
  provider: string | null;
  away: GameOddsSide;
  home: GameOddsSide;
  details: string | null;
};

export type ScoringPlay = {
  quarter: string;
  teamAbbrev: string;
  description: string;
  score: string;
};

export type TeamStatRow = {
  label: string;
  away: string;
  home: string;
};

export type LineScore = {
  periods: string[];
  away: Array<number | string>;
  home: Array<number | string>;
};

export type WinProbabilityPoint = {
  awayPct: number;
};

export type GameDashboardData = {
  game: ScheduleGame;
  predictor: { awayPct: number; homePct: number } | null;
  odds: GameOdds | null;
  seasonLeaders: GameLeaderCategory[] | null;
  gameLeaders: GameLeaderCategory[] | null;
  injuries: InjuryRow[] | null;
  awayForm: FormGame[] | null;
  homeForm: FormGame[] | null;
  standings: DivisionStanding[] | null;
  lineScore: LineScore | null;
  winProbability: WinProbabilityPoint[] | null;
  scoringPlays: ScoringPlay[] | null;
  allPlays: ScoringPlay[] | null;
  teamStats: TeamStatRow[] | null;
};

/** ESPN uses WSH; Sleeper CDN uses WAS. */
const SLEEPER_ABBREV: Record<string, string> = {
  WSH: "WAS",
};

const TEAM_STAT_NAMES = [
  "firstDowns",
  "totalYards",
  "netPassingYards",
  "rushingYards",
  "turnovers",
  "possessionTime",
  "sacksYardsLost",
  "penalties",
] as const;

const EMPTY_LEADER: GameLeaderSide = {
  name: "None",
  position: "",
  line: "--",
};

function formatMoneyline(value: number | string | null | undefined): string {
  if (value == null || value === "") return MISSING_VALUE;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return MISSING_VALUE;
    if (trimmed.startsWith("+") || trimmed.startsWith("-")) return trimmed;
    const asNumber = Number(trimmed);
    if (!Number.isFinite(asNumber)) return trimmed;
    return asNumber > 0 ? `+${asNumber}` : String(asNumber);
  }
  if (!Number.isFinite(value)) return MISSING_VALUE;
  return value > 0 ? `+${value}` : String(value);
}

function formatLineOdds(
  line: string | null | undefined,
  odds: string | number | null | undefined,
): string {
  const lineText = line?.trim() || null;
  const oddsText =
    odds == null || odds === ""
      ? null
      : typeof odds === "number"
        ? formatMoneyline(odds)
        : odds.trim();
  if (lineText && oddsText) return `${lineText} / ${oddsText}`;
  if (lineText) return lineText;
  if (oddsText) return oddsText;
  return MISSING_VALUE;
}

function parseStatus(
  competition: EspnHeaderCompetition | undefined,
): Pick<ScheduleGame, "status" | "statusText" | "period" | "displayClock"> {
  const type = competition?.status?.type;
  const state = type?.state;
  const period = competition?.status?.period ?? null;
  const displayClock = competition?.status?.displayClock ?? null;

  if (state === "in") {
    return {
      status: "in",
      statusText:
        type?.shortDetail ?? type?.description ?? "Live",
      period,
      displayClock,
    };
  }

  if (state === "post" || type?.completed) {
    return {
      status: "post",
      statusText: type?.shortDetail ?? type?.description ?? "Final",
      period,
      displayClock,
    };
  }

  return {
    status: "pre",
    statusText: type?.shortDetail ?? type?.description ?? "Scheduled",
    period: null,
    displayClock: null,
  };
}

function parseTeam(competitor: EspnCompetitor | undefined): ScheduleTeam {
  const abbreviation = competitor?.team?.abbreviation?.toUpperCase() ?? "???";
  const espnLogo = competitor?.team?.logo;
  const sleeperAbbrev = SLEEPER_ABBREV[abbreviation] ?? abbreviation;
  const sleeperLogo =
    abbreviation !== "???" ? getSleeperTeamLogoUrl(sleeperAbbrev) : null;

  const rawScore = competitor?.score;
  const score =
    rawScore === undefined || rawScore === null || rawScore === ""
      ? null
      : Number(rawScore);

  const nickname =
    competitor?.team?.name ??
    competitor?.team?.shortDisplayName ??
    abbreviation;
  const displayName = competitor?.team?.displayName ?? abbreviation;
  const city =
    competitor?.team?.location ??
    (displayName.endsWith(nickname)
      ? displayName.slice(0, -nickname.length).trim()
      : displayName);

  const records = competitor?.record ?? competitor?.records ?? [];
  const overall = records.find((record) => {
    const type = record.type;
    const name = "name" in record ? record.name : undefined;
    return type === "total" || name === "overall";
  });

  return {
    abbreviation,
    displayName,
    city,
    nickname,
    shortName:
      competitor?.team?.shortDisplayName ??
      competitor?.team?.name ??
      abbreviation,
    logoUrl: sleeperLogo ?? espnLogo ?? "",
    record:
      overall?.summary?.trim() ||
      ("displayValue" in (overall ?? {})
        ? (overall as { displayValue?: string }).displayValue?.trim()
        : undefined) ||
      "0-0",
    score: Number.isFinite(score) ? score : null,
    winner: competitor?.winner ?? null,
  };
}

function parseNetwork(
  competition: EspnHeaderCompetition | undefined,
): string | null {
  const fromMedia = competition?.broadcasts
    ?.map((broadcast) => broadcast.media?.shortName)
    .filter((name): name is string => Boolean(name));
  if (fromMedia?.length) return fromMedia.join(", ");

  const fromNames = competition?.broadcasts
    ?.flatMap((broadcast) => broadcast.names ?? [])
    .filter(Boolean);
  return fromNames?.length ? fromNames.join(", ") : null;
}

function parseGame(payload: EspnSummaryResponse, eventId: string): ScheduleGame {
  const competition = payload.header?.competitions?.[0];
  if (!competition?.competitors?.length) {
    throw new Error("ESPN summary missing competition");
  }

  const homeCompetitor = competition.competitors.find(
    (c) => c.homeAway === "home",
  );
  const awayCompetitor = competition.competitors.find(
    (c) => c.homeAway === "away",
  );

  const venue = payload.gameInfo?.venue;
  const city = venue?.address?.city;
  const state = venue?.address?.state;
  const venueLocation =
    city && state ? `${city}, ${state}` : (city ?? state ?? null);

  const { status, statusText, period, displayClock } =
    parseStatus(competition);

  return {
    id: payload.header?.id ?? eventId,
    kickoff: competition.date ?? new Date().toISOString(),
    venue: venue?.fullName ?? "TBD",
    venueLocation,
    status,
    statusText,
    period,
    displayClock,
    network: parseNetwork(competition),
    odds: null,
    home: parseTeam(homeCompetitor),
    away: parseTeam(awayCompetitor),
  };
}

function parsePredictor(
  payload: EspnSummaryResponse,
): GameDashboardData["predictor"] {
  const awayRaw = payload.predictor?.awayTeam?.gameProjection;
  const homeRaw = payload.predictor?.homeTeam?.gameProjection;
  if (awayRaw == null || homeRaw == null) return null;
  const awayPct = Number(awayRaw);
  const homePct = Number(homeRaw);
  if (!Number.isFinite(awayPct) || !Number.isFinite(homePct)) return null;
  return { awayPct, homePct };
}

function parseOdds(payload: EspnSummaryResponse): GameOdds | null {
  const entry = payload.pickcenter?.[0];
  if (!entry) return null;

  const awaySpread = entry.pointSpread?.away;
  const homeSpread = entry.pointSpread?.home;
  const over = entry.total?.over;
  const under = entry.total?.under;
  const awayMl = entry.moneyline?.away;
  const homeMl = entry.moneyline?.home;

  return {
    provider: entry.provider?.name?.trim() || null,
    details: entry.details?.trim() || null,
    away: {
      open: formatLineOdds(over?.open?.line, over?.open?.odds),
      spread: formatLineOdds(
        awaySpread?.close?.line ?? awaySpread?.open?.line,
        awaySpread?.close?.odds ??
          awaySpread?.open?.odds ??
          entry.awayTeamOdds?.spreadOdds,
      ),
      total: formatLineOdds(
        over?.close?.line ?? over?.open?.line,
        over?.close?.odds ?? over?.open?.odds,
      ),
      moneyline: formatMoneyline(
        awayMl?.close?.odds ??
          awayMl?.open?.odds ??
          entry.awayTeamOdds?.moneyLine,
      ),
    },
    home: {
      open: formatLineOdds(
        homeSpread?.open?.line,
        homeSpread?.open?.odds,
      ),
      spread: formatLineOdds(
        homeSpread?.close?.line ?? homeSpread?.open?.line,
        homeSpread?.close?.odds ??
          homeSpread?.open?.odds ??
          entry.homeTeamOdds?.spreadOdds,
      ),
      total: formatLineOdds(
        under?.close?.line ?? under?.open?.line,
        under?.close?.odds ?? under?.open?.odds,
      ),
      moneyline: formatMoneyline(
        homeMl?.close?.odds ??
          homeMl?.open?.odds ??
          entry.homeTeamOdds?.moneyLine,
      ),
    },
  };
}

function parseLeaderSide(
  entry:
    | {
        displayValue?: string;
        athlete?: {
          displayName?: string;
          shortName?: string;
          position?: { abbreviation?: string };
        };
      }
    | undefined,
): GameLeaderSide {
  if (!entry?.athlete?.displayName && !entry?.displayValue) {
    return EMPTY_LEADER;
  }
  return {
    name: entry.athlete?.displayName?.trim() || "None",
    position: entry.athlete?.position?.abbreviation?.trim() || "",
    line: entry.displayValue?.trim() || "--",
  };
}

function parseLeaders(
  payload: EspnSummaryResponse,
  awayAbbrev: string,
  homeAbbrev: string,
): GameLeaderCategory[] | null {
  const groups = payload.leaders;
  if (!groups?.length) return null;

  const byAbbrev = new Map(
    groups.map((group) => [
      group.team?.abbreviation?.toUpperCase() ?? "",
      group,
    ]),
  );
  const awayGroup = byAbbrev.get(awayAbbrev.toUpperCase());
  const homeGroup = byAbbrev.get(homeAbbrev.toUpperCase());
  if (!awayGroup && !homeGroup) return null;

  const categoryOrder: string[] = [];
  const seen = new Set<string>();
  for (const group of [awayGroup, homeGroup]) {
    for (const cat of group?.leaders ?? []) {
      const key = cat.displayName ?? cat.name;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      categoryOrder.push(key);
    }
  }

  if (categoryOrder.length === 0) return null;

  return categoryOrder.map((category) => {
    const awayCat = awayGroup?.leaders?.find(
      (cat) => (cat.displayName ?? cat.name) === category,
    );
    const homeCat = homeGroup?.leaders?.find(
      (cat) => (cat.displayName ?? cat.name) === category,
    );
    return {
      category,
      away: parseLeaderSide(awayCat?.leaders?.[0]),
      home: parseLeaderSide(homeCat?.leaders?.[0]),
    };
  });
}

function formatReturnDate(raw: string | undefined): string {
  if (!raw) return MISSING_VALUE;
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function parseInjuries(
  payload: EspnSummaryResponse,
  awayAbbrev: string,
  homeAbbrev: string,
): InjuryRow[] | null {
  const groups = payload.injuries;
  if (!groups) return null;

  const rows: InjuryRow[] = [];
  for (const group of groups) {
    const abbrev = group.team?.abbreviation?.toUpperCase() ?? "";
    const side =
      abbrev === awayAbbrev.toUpperCase()
        ? "away"
        : abbrev === homeAbbrev.toUpperCase()
          ? "home"
          : null;
    if (!side) continue;

    for (const injury of group.injuries ?? []) {
      const status =
        injury.details?.fantasyStatus?.abbreviation?.trim() ||
        injury.status?.trim() ||
        injury.type?.abbreviation?.trim() ||
        MISSING_VALUE;
      rows.push({
        name: injury.athlete?.displayName?.trim() || MISSING_VALUE,
        position: injury.athlete?.position?.abbreviation?.trim() || "",
        status,
        estReturn: formatReturnDate(injury.details?.returnDate),
        side,
      });
    }
  }

  return rows;
}

function parseForm(
  payload: EspnSummaryResponse,
  abbrev: string,
): FormGame[] | null {
  if (!payload.lastFiveGames) return null;

  const group = payload.lastFiveGames.find(
    (entry) =>
      entry.team?.abbreviation?.toUpperCase() === abbrev.toUpperCase(),
  );
  if (!group) return [];

  return (group.events ?? []).map((event) => {
    const date = event.gameDate ? new Date(event.gameDate) : null;
    const dateLabel =
      date && !Number.isNaN(date.getTime())
        ? new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }).format(date)
        : MISSING_VALUE;

    return {
      date: dateLabel,
      opponent: event.opponent?.displayName?.trim() || MISSING_VALUE,
      opponentAbbrev: event.opponent?.abbreviation?.toUpperCase() || MISSING_VALUE,
      result: event.gameResult?.trim() || MISSING_VALUE,
      score: event.score?.trim() || MISSING_VALUE,
    };
  });
}

function abbrevFromLogo(href: string | undefined): string | null {
  if (!href) return null;
  const match = href.match(/\/([a-z0-9]+)\.png/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function parseStandings(
  payload: EspnSummaryResponse,
  awayAbbrev: string,
  homeAbbrev: string,
): DivisionStanding[] | null {
  const groups = payload.standings?.groups;
  if (!groups?.length) return null;

  return groups.map((group) => {
    const name =
      group.divisionHeader?.trim() ||
      group.header?.replace(/\s*Standings\s*$/i, "").trim() ||
      "Standings";

    const rows = (group.standings?.entries ?? []).map((entry) => {
      const stats = new Map(
        (entry.stats ?? []).map((stat) => [stat.name ?? "", stat]),
      );
      const teamName =
        typeof entry.team === "string"
          ? entry.team
          : (entry.team?.displayName ?? entry.team?.name ?? MISSING_VALUE);
      const abbrev =
        (typeof entry.team === "object"
          ? entry.team?.abbreviation?.toUpperCase()
          : null) ||
        abbrevFromLogo(entry.logo?.[0]?.href) ||
        MISSING_VALUE;

      const w = stats.get("wins")?.displayValue ?? "0";
      const l = stats.get("losses")?.displayValue ?? "0";
      const t = stats.get("ties")?.displayValue ?? "0";
      const pct = stats.get("winPercent")?.displayValue ?? ".000";
      const pf = stats.get("pointsFor")?.displayValue ?? "0";
      const pa = stats.get("pointsAgainst")?.displayValue ?? "0";

      return {
        abbrev,
        name: teamName,
        w,
        l,
        t,
        pct,
        pf,
        pa,
        highlight:
          abbrev === awayAbbrev.toUpperCase() ||
          abbrev === homeAbbrev.toUpperCase(),
      } satisfies StandingRow;
    });

    return { name, rows };
  });
}

function quarterLabel(period: number | undefined): string {
  if (period == null) return MISSING_VALUE;
  if (period <= 4) return `Q${period}`;
  if (period === 5) return "OT";
  return `OT${period - 4}`;
}

function parseLineScore(
  payload: EspnSummaryResponse,
  game: ScheduleGame,
): LineScore | null {
  const competition = payload.header?.competitions?.[0];
  const away = competition?.competitors?.find((c) => c.homeAway === "away");
  const home = competition?.competitors?.find((c) => c.homeAway === "home");
  const awayLines = away?.linescores;
  const homeLines = home?.linescores;
  if (!awayLines?.length && !homeLines?.length) {
    if (game.status === "pre") {
      return {
        periods: ["1", "2", "3", "4", "T"],
        away: [MISSING_VALUE, MISSING_VALUE, MISSING_VALUE, MISSING_VALUE, MISSING_VALUE],
        home: [MISSING_VALUE, MISSING_VALUE, MISSING_VALUE, MISSING_VALUE, MISSING_VALUE],
      };
    }
    return null;
  }

  const length = Math.max(awayLines?.length ?? 0, homeLines?.length ?? 0, 4);
  const periods = Array.from({ length }, (_, index) => {
    if (index < 4) return String(index + 1);
    if (index === 4 && length === 5) return "OT";
    return `OT${index - 3}`;
  });
  periods.push("T");

  const mapLine = (
    lines: Array<{ displayValue?: string }> | undefined,
    total: number | null,
  ) => {
    const values = Array.from({ length }, (_, index) => {
      const raw = lines?.[index]?.displayValue;
      if (raw == null || raw === "") return MISSING_VALUE;
      const num = Number(raw);
      return Number.isFinite(num) ? num : raw;
    });
    values.push(total ?? MISSING_VALUE);
    return values;
  };

  return {
    periods,
    away: mapLine(awayLines, game.away.score),
    home: mapLine(homeLines, game.home.score),
  };
}

function parseTeamStats(
  payload: EspnSummaryResponse,
  awayAbbrev: string,
  homeAbbrev: string,
): TeamStatRow[] | null {
  const teams = payload.boxscore?.teams;
  if (!teams?.length) return null;

  const away = teams.find(
    (team) =>
      team.homeAway === "away" ||
      team.team?.abbreviation?.toUpperCase() === awayAbbrev.toUpperCase(),
  );
  const home = teams.find(
    (team) =>
      team.homeAway === "home" ||
      team.team?.abbreviation?.toUpperCase() === homeAbbrev.toUpperCase(),
  );
  if (!away && !home) return null;

  const awayByName = new Map(
    (away?.statistics ?? []).map((stat) => [stat.name ?? "", stat]),
  );
  const homeByName = new Map(
    (home?.statistics ?? []).map((stat) => [stat.name ?? "", stat]),
  );

  const names =
    TEAM_STAT_NAMES.filter(
      (name) => awayByName.has(name) || homeByName.has(name),
    ).length > 0
      ? TEAM_STAT_NAMES.filter(
          (name) => awayByName.has(name) || homeByName.has(name),
        )
      : Array.from(
          new Set([
            ...awayByName.keys(),
            ...homeByName.keys(),
          ]),
        ).slice(0, 8);

  return names.map((name) => {
    const awayStat = awayByName.get(name);
    const homeStat = homeByName.get(name);
    return {
      label:
        awayStat?.label?.trim() ||
        homeStat?.label?.trim() ||
        name,
      away: awayStat?.displayValue?.trim() || MISSING_VALUE,
      home: homeStat?.displayValue?.trim() || MISSING_VALUE,
    };
  });
}

function parseScoringPlays(
  payload: EspnSummaryResponse,
): ScoringPlay[] | null {
  const plays = payload.scoringPlays;
  if (!plays) return null;

  return plays.map((play) => ({
    quarter: quarterLabel(play.period?.number),
    teamAbbrev: play.team?.abbreviation?.toUpperCase() || MISSING_VALUE,
    description: play.text?.trim() || MISSING_VALUE,
    score: `${play.awayScore ?? MISSING_VALUE}-${play.homeScore ?? MISSING_VALUE}`,
  }));
}

function parseAllPlays(
  payload: EspnSummaryResponse,
  awayAbbrev: string,
  homeAbbrev: string,
): ScoringPlay[] | null {
  const drives = payload.drives?.previous;
  if (!drives) return null;

  const plays: ScoringPlay[] = [];
  for (const drive of drives) {
    const driveAbbrev = drive.team?.abbreviation?.toUpperCase();
    for (const play of drive.plays ?? []) {
      const text = play.text?.trim();
      if (!text) continue;
      plays.push({
        quarter: quarterLabel(play.period?.number),
        teamAbbrev:
          play.team?.abbreviation?.toUpperCase() ||
          driveAbbrev ||
          (text.includes(awayAbbrev) ? awayAbbrev : homeAbbrev) ||
          MISSING_VALUE,
        description: text,
        score: `${play.awayScore ?? MISSING_VALUE}-${play.homeScore ?? MISSING_VALUE}`,
      });
    }
  }
  return plays;
}

function parseWinProbability(
  payload: EspnSummaryResponse,
): WinProbabilityPoint[] | null {
  const points = payload.winprobability;
  if (!points) return null;

  return points
    .map((point) => {
      const home = point.homeWinPercentage;
      if (home == null || !Number.isFinite(home)) return null;
      return { awayPct: Math.round((1 - home) * 1000) / 10 };
    })
    .filter((point): point is WinProbabilityPoint => point !== null);
}

function buildDashboard(payload: EspnSummaryResponse, eventId: string): GameDashboardData {
  const game = parseGame(payload, eventId);
  const away = game.away.abbreviation;
  const home = game.home.abbreviation;

  const odds = parseOdds(payload);
  if (odds?.details) {
    game.odds = odds.details;
  }

  return {
    game,
    predictor: parsePredictor(payload),
    odds,
    seasonLeaders: parseLeaders(payload, away, home),
    gameLeaders: parseLeaders(payload, away, home),
    injuries: parseInjuries(payload, away, home),
    awayForm: parseForm(payload, away),
    homeForm: parseForm(payload, home),
    standings: parseStandings(payload, away, home),
    lineScore: parseLineScore(payload, game),
    winProbability: parseWinProbability(payload),
    scoringPlays: parseScoringPlays(payload),
    allPlays: parseAllPlays(payload, away, home),
    teamStats: parseTeamStats(payload, away, home),
  };
}

export async function getNflGameSummary(
  eventId: string,
): Promise<GameDashboardData> {
  const url = new URL(ESPN_SUMMARY);
  url.searchParams.set("event", eventId);

  const response = await fetch(url, {
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    throw new Error(`ESPN game summary failed: ${response.status}`);
  }

  const payload = (await response.json()) as EspnSummaryResponse;
  if (!payload.header?.competitions?.[0]) {
    throw new Error("ESPN game summary missing header competition");
  }

  return buildDashboard(payload, eventId);
}
