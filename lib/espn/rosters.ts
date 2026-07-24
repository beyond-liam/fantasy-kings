/**
 * ESPN NFL team numeric ids keyed by Sleeper / Fantasy Kings abbrev.
 * Kept free of React so seed scripts can import safely.
 */
export const ESPN_TEAM_IDS: Record<string, string> = {
  ARI: "22",
  ATL: "1",
  BAL: "33",
  BUF: "2",
  CAR: "29",
  CHI: "3",
  CIN: "4",
  CLE: "5",
  DAL: "6",
  DEN: "7",
  DET: "8",
  GB: "9",
  HOU: "34",
  IND: "11",
  JAX: "30",
  KC: "12",
  LAC: "24",
  LAR: "14",
  LV: "13",
  MIA: "15",
  MIN: "16",
  NE: "17",
  NO: "18",
  NYG: "19",
  NYJ: "20",
  PHI: "21",
  PIT: "23",
  SEA: "26",
  SF: "25",
  TB: "27",
  TEN: "10",
  WAS: "28",
  WSH: "28",
};

const ESPN_ROSTER =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";

export type EspnRosterAthlete = {
  espnId: string;
  displayName: string;
  normalizedName: string;
  jersey: string | null;
  position: string | null;
};

type EspnRosterPayload = {
  athletes?: Array<{
    items?: Array<{
      id?: string | number;
      displayName?: string;
      jersey?: string | number;
      position?: { abbreviation?: string };
    }>;
  }>;
};

/** Normalize player names for cross-provider matching. */
export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export async function fetchEspnTeamRoster(
  teamAbbrev: string,
): Promise<EspnRosterAthlete[]> {
  const teamId = ESPN_TEAM_IDS[teamAbbrev.toUpperCase()];
  if (!teamId) {
    return [];
  }

  const response = await fetch(`${ESPN_ROSTER}/${teamId}/roster`, {
    // Seed / cron — always fresh enough; avoid Next data cache coupling.
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `ESPN roster failed for ${teamAbbrev} (${teamId}): ${response.status}`,
    );
  }

  const payload = (await response.json()) as EspnRosterPayload;
  const athletes: EspnRosterAthlete[] = [];

  for (const group of payload.athletes ?? []) {
    for (const item of group.items ?? []) {
      const espnId = item.id != null ? String(item.id).trim() : "";
      const displayName = item.displayName?.trim() ?? "";
      if (!espnId || !displayName) {
        continue;
      }
      athletes.push({
        espnId,
        displayName,
        normalizedName: normalizePlayerName(displayName),
        jersey:
          item.jersey != null && String(item.jersey).trim() !== ""
            ? String(item.jersey).trim()
            : null,
        position: item.position?.abbreviation?.toUpperCase() ?? null,
      });
    }
  }

  return athletes;
}

export type PlayerEspnMatchInput = {
  playerId: string;
  fullName: string;
  nflTeam: string;
  primaryPositionId: string;
  jerseyNumber: number | null;
};

/**
 * Match Fantasy Kings players to ESPN athlete ids via current team rosters.
 * Prefer exact normalized name; fall back to jersey + position when unique.
 */
export async function matchPlayersToEspnIds(
  players: PlayerEspnMatchInput[],
): Promise<Map<string, string>> {
  const byTeam = new Map<string, PlayerEspnMatchInput[]>();
  for (const player of players) {
    if (player.primaryPositionId === "DEF") {
      continue;
    }
    const team = player.nflTeam.toUpperCase();
    if (!ESPN_TEAM_IDS[team]) {
      continue;
    }
    const list = byTeam.get(team) ?? [];
    list.push(player);
    byTeam.set(team, list);
  }

  const matches = new Map<string, string>();

  for (const [team, teamPlayers] of byTeam) {
    const roster = await fetchEspnTeamRoster(team);
    const byName = new Map<string, EspnRosterAthlete[]>();
    for (const athlete of roster) {
      const list = byName.get(athlete.normalizedName) ?? [];
      list.push(athlete);
      byName.set(athlete.normalizedName, list);
    }

    for (const player of teamPlayers) {
      const nameKey = normalizePlayerName(player.fullName);
      const nameHits = byName.get(nameKey) ?? [];
      if (nameHits.length === 1) {
        matches.set(player.playerId, nameHits[0].espnId);
        continue;
      }
      if (nameHits.length > 1 && player.jerseyNumber != null) {
        const jersey = String(player.jerseyNumber);
        const jerseyHits = nameHits.filter((a) => a.jersey === jersey);
        if (jerseyHits.length === 1) {
          matches.set(player.playerId, jerseyHits[0].espnId);
          continue;
        }
      }

      if (player.jerseyNumber == null) {
        continue;
      }
      const jersey = String(player.jerseyNumber);
      const jerseyPosHits = roster.filter(
        (athlete) =>
          athlete.jersey === jersey &&
          (athlete.position === player.primaryPositionId ||
            (player.primaryPositionId === "K" &&
              (athlete.position === "PK" || athlete.position === "K"))),
      );
      if (jerseyPosHits.length === 1) {
        matches.set(player.playerId, jerseyPosHits[0].espnId);
      }
    }
  }

  return matches;
}
