import { getSleeperTeamLogoUrl } from "@/lib/sleeper/avatars";
import {
  formatWeekRange,
  type WeekWindow,
} from "@/lib/nfl/schedule-week";

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

type EspnCalendarEntry = {
  label?: string;
  detail?: string;
  value?: string;
  startDate?: string;
  endDate?: string;
};

type EspnCalendarGroup = {
  label?: string;
  entries?: EspnCalendarEntry[];
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  winner?: boolean | null;
  records?: Array<{
    type?: string;
    name?: string;
    summary?: string;
  }>;
  team?: {
    abbreviation?: string;
    displayName?: string;
    shortDisplayName?: string;
    name?: string;
    location?: string;
    logo?: string;
  };
};

type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  competitions?: Array<{
    status?: {
      type?: {
        state?: string;
        completed?: boolean;
        description?: string;
        detail?: string;
        shortDetail?: string;
      };
      displayClock?: string;
      period?: number;
    };
    venue?: {
      fullName?: string;
      address?: {
        city?: string;
        state?: string;
      };
    };
    broadcasts?: Array<{
      market?: string;
      names?: string[];
    }>;
    geoBroadcasts?: Array<{
      media?: {
        shortName?: string;
      };
    }>;
    odds?: Array<{
      details?: string;
      overUnder?: number;
      spread?: number;
    }>;
    competitors?: EspnCompetitor[];
  }>;
};

type EspnScoreboardResponse = {
  leagues?: Array<{
    calendar?: EspnCalendarGroup[];
  }>;
  events?: EspnEvent[];
};

export type ScheduleTeam = {
  abbreviation: string;
  displayName: string;
  city: string;
  nickname: string;
  shortName: string;
  logoUrl: string;
  record: string;
  score: number | null;
  winner: boolean | null;
};

export type ScheduleGame = {
  id: string;
  kickoff: string;
  venue: string;
  venueLocation: string | null;
  status: "pre" | "in" | "post";
  statusText: string;
  /** NFL period (1–4 regulation, 5+ OT). Null when pre/unknown. */
  period: number | null;
  /** Display clock for the current period, e.g. "7:32". */
  displayClock: string | null;
  network: string | null;
  odds: string | null;
  home: ScheduleTeam;
  away: ScheduleTeam;
};

export type ScheduleWeek = WeekWindow & {
  label: string;
  rangeLabel: string;
};

export type NflScoreboard = {
  season: number;
  week: number;
  weeks: ScheduleWeek[];
  games: ScheduleGame[];
  hasLiveGames: boolean;
};

/** ESPN uses WSH; Sleeper CDN uses WAS. */
const SLEEPER_ABBREV: Record<string, string> = {
  WSH: "WAS",
};

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
  const overall = competitor?.records?.find(
    (record) => record.type === "total" || record.name === "overall",
  );

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
    record: overall?.summary?.trim() || "0-0",
    score: Number.isFinite(score) ? score : null,
    winner: competitor?.winner ?? null,
  };
}

function parseStatus(
  competition: NonNullable<EspnEvent["competitions"]>[number] | undefined,
): Pick<ScheduleGame, "status" | "statusText" | "period" | "displayClock"> {
  const type = competition?.status?.type;
  const state = type?.state;
  const period = competition?.status?.period ?? null;
  const displayClock = competition?.status?.displayClock ?? null;

  if (state === "in") {
    const periodLabel = period ? `Q${period}` : null;
    const statusText =
      type?.shortDetail ??
      [periodLabel, displayClock].filter(Boolean).join(" ") ??
      type?.description ??
      "Live";

    return { status: "in", statusText, period, displayClock };
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

function parseNetwork(
  competition: NonNullable<EspnEvent["competitions"]>[number],
): string | null {
  const fromBroadcasts = competition.broadcasts
    ?.flatMap((broadcast) => broadcast.names ?? [])
    .filter(Boolean);
  if (fromBroadcasts?.length) {
    return fromBroadcasts.join(", ");
  }

  const fromGeo = competition.geoBroadcasts
    ?.map((broadcast) => broadcast.media?.shortName)
    .filter((name): name is string => Boolean(name));

  return fromGeo?.length ? fromGeo.join(", ") : null;
}

function parseOdds(
  competition: NonNullable<EspnEvent["competitions"]>[number],
): string | null {
  const details = competition.odds?.[0]?.details?.trim();
  return details || null;
}

function parseGame(event: EspnEvent): ScheduleGame | null {
  const competition = event.competitions?.[0];
  if (!event.id || !event.date || !competition) {
    return null;
  }

  const homeCompetitor = competition.competitors?.find(
    (c) => c.homeAway === "home",
  );
  const awayCompetitor = competition.competitors?.find(
    (c) => c.homeAway === "away",
  );

  const venue = competition.venue;
  const city = venue?.address?.city;
  const state = venue?.address?.state;
  const venueLocation =
    city && state ? `${city}, ${state}` : (city ?? state ?? null);

  const { status, statusText, period, displayClock } =
    parseStatus(competition);

  return {
    id: event.id,
    kickoff: event.date,
    venue: venue?.fullName ?? "TBD",
    venueLocation,
    status,
    statusText,
    period,
    displayClock,
    network: parseNetwork(competition),
    odds: parseOdds(competition),
    home: parseTeam(homeCompetitor),
    away: parseTeam(awayCompetitor),
  };
}

function parseWeeks(payload: EspnScoreboardResponse): ScheduleWeek[] {
  const groups = payload.leagues?.[0]?.calendar ?? [];
  const regular = groups.find((group) => group.label === "Regular Season");

  return (regular?.entries ?? [])
    .map((entry) => {
      const number = Number(entry.value);
      if (!Number.isFinite(number) || !entry.startDate || !entry.endDate) {
        return null;
      }

      const startDate = new Date(entry.startDate);
      const endDate = new Date(entry.endDate);

      return {
        number,
        label: entry.label ?? `Week ${number}`,
        rangeLabel: formatWeekRange(startDate, endDate),
        startDate,
        endDate,
      } satisfies ScheduleWeek;
    })
    .filter((week): week is ScheduleWeek => week !== null)
    .sort((a, b) => a.number - b.number);
}

export async function getNflScoreboard(options: {
  season: number;
  week: number;
}): Promise<NflScoreboard> {
  const { season, week } = options;
  const url = new URL(ESPN_SCOREBOARD);
  url.searchParams.set("dates", String(season));
  url.searchParams.set("seasontype", "2");
  url.searchParams.set("week", String(week));

  const response = await fetch(url, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`ESPN scoreboard failed: ${response.status}`);
  }

  const payload = (await response.json()) as EspnScoreboardResponse;
  const weeks = parseWeeks(payload);
  const games = (payload.events ?? [])
    .map(parseGame)
    .filter((game): game is ScheduleGame => game !== null)
    .sort(
      (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
    );

  const hasLiveGames = games.some((game) => game.status === "in");

  return {
    season,
    week,
    weeks,
    games,
    hasLiveGames,
  };
}
