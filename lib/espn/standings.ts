import { getSleeperTeamLogoUrl } from "@/lib/sleeper/avatars";

const ESPN_STANDINGS =
  "https://site.api.espn.com/apis/v2/sports/football/nfl/standings";

/** ESPN uses WSH; Sleeper CDN uses WAS. */
const SLEEPER_ABBREV: Record<string, string> = {
  WSH: "WAS",
};

type EspnStandingStat = {
  name?: string;
  abbreviation?: string;
  displayValue?: string;
  value?: number;
};

type EspnStandingEntry = {
  team?: {
    abbreviation?: string;
    location?: string;
    name?: string;
    displayName?: string;
    shortDisplayName?: string;
  };
  stats?: EspnStandingStat[];
};

type EspnStandingGroup = {
  id?: string;
  name?: string;
  abbreviation?: string;
  isConference?: boolean;
  standings?: {
    entries?: EspnStandingEntry[];
  };
  children?: EspnStandingGroup[];
};

type EspnStandingsResponse = {
  children?: EspnStandingGroup[];
  season?: { year?: number } | number;
};

export type NflStandingRow = {
  rank: number;
  abbreviation: string;
  displayName: string;
  logoUrl: string;
  wins: string;
  losses: string;
  ties: string;
  winPct: string;
  winPctValue: number;
};

export type NflStandingGroup = {
  id: string;
  name: string;
  /** Short header label for the team column (e.g. TEAM, AFC, NFC EAST). */
  teamColumnLabel: string;
  rows: NflStandingRow[];
};

export type NflStandings = {
  season: number;
  /** All 32 teams sorted by win %. */
  all: NflStandingGroup;
  /** AFC + NFC conference tables. */
  conferences: NflStandingGroup[];
  /** Eight division tables. */
  divisions: NflStandingGroup[];
};

function statMap(stats: EspnStandingStat[] | undefined) {
  return new Map((stats ?? []).map((stat) => [stat.name ?? "", stat]));
}

function parseEntry(entry: EspnStandingEntry, rank: number): NflStandingRow {
  const stats = statMap(entry.stats);
  const abbreviation =
    entry.team?.abbreviation?.toUpperCase() ?? "???";
  const sleeperAbbrev = SLEEPER_ABBREV[abbreviation] ?? abbreviation;

  const winPctDisplay = stats.get("winPercent")?.displayValue?.trim() || ".000";
  const winPctValue = Number(stats.get("winPercent")?.value);
  const parsedPct = Number.isFinite(winPctValue)
    ? winPctValue
    : Number(winPctDisplay);

  return {
    rank,
    abbreviation,
    displayName:
      entry.team?.displayName ??
      entry.team?.shortDisplayName ??
      entry.team?.name ??
      abbreviation,
    logoUrl:
      abbreviation !== "???" ? getSleeperTeamLogoUrl(sleeperAbbrev) : "",
    wins: stats.get("wins")?.displayValue ?? "0",
    losses: stats.get("losses")?.displayValue ?? "0",
    ties: stats.get("ties")?.displayValue ?? "0",
    winPct: winPctDisplay.startsWith(".")
      ? winPctDisplay
      : Number.isFinite(parsedPct)
        ? parsedPct.toFixed(3).replace(/^0/, "")
        : ".000",
    winPctValue: Number.isFinite(parsedPct) ? parsedPct : 0,
  };
}

function parseGroupEntries(
  entries: EspnStandingEntry[] | undefined,
): NflStandingRow[] {
  return (entries ?? []).map((entry, index) => parseEntry(entry, index + 1));
}

function conferenceGroups(
  payload: EspnStandingsResponse,
): NflStandingGroup[] {
  return (payload.children ?? []).map((group) => {
    const abbr = group.abbreviation?.toUpperCase() || group.name || "CONF";
    return {
      id: group.id ?? abbr,
      name: group.name ?? abbr,
      teamColumnLabel: abbr,
      rows: parseGroupEntries(group.standings?.entries),
    };
  });
}

function divisionGroups(
  payload: EspnStandingsResponse,
): NflStandingGroup[] {
  const groups: NflStandingGroup[] = [];
  for (const conference of payload.children ?? []) {
    for (const division of conference.children ?? []) {
      const name = division.name ?? "Division";
      groups.push({
        id: division.id ?? name,
        name,
        teamColumnLabel: name.toUpperCase(),
        rows: parseGroupEntries(division.standings?.entries),
      });
    }
  }
  return groups;
}

function buildAllGroup(conferences: NflStandingGroup[]): NflStandingGroup {
  const rows = conferences
    .flatMap((group) => group.rows)
    .toSorted((a, b) => {
      if (b.winPctValue !== a.winPctValue) {
        return b.winPctValue - a.winPctValue;
      }
      const aWins = Number(a.wins);
      const bWins = Number(b.wins);
      if (bWins !== aWins) return bWins - aWins;
      return a.abbreviation.localeCompare(b.abbreviation);
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    id: "all",
    name: "All Teams",
    teamColumnLabel: "TEAM",
    rows,
  };
}

async function fetchStandingsPayload(
  season: number,
  level?: number,
): Promise<EspnStandingsResponse> {
  const url = new URL(ESPN_STANDINGS);
  url.searchParams.set("season", String(season));
  if (level != null) {
    url.searchParams.set("level", String(level));
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`ESPN standings failed: ${response.status}`);
  }

  return (await response.json()) as EspnStandingsResponse;
}

export async function getNflStandings(season: number): Promise<NflStandings> {
  const [conferencePayload, divisionPayload] = await Promise.all([
    fetchStandingsPayload(season),
    fetchStandingsPayload(season, 3),
  ]);

  const conferences = conferenceGroups(conferencePayload);
  const divisions = divisionGroups(divisionPayload);

  return {
    season,
    all: buildAllGroup(conferences),
    conferences,
    divisions,
  };
}
