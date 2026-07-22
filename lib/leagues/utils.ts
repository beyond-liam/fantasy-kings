export function slugifyLeagueName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** Same rules as league names — used for team URL segments. */
export const slugifyTeamName = slugifyLeagueName;

/** Path segments under `/league/[slug]/` that are app routes, not team pages. */
export const RESERVED_LEAGUE_PATH_SEGMENTS = new Set([
  "team",
  "players",
  "scores",
  "trades",
  "activity",
  "draft",
  "settings",
]);

export function allocateUniqueTeamSlug(
  name: string,
  taken: Set<string>,
  fallbackId?: string,
): string {
  const base = slugifyTeamName(name) || "team";
  let candidate = RESERVED_LEAGUE_PATH_SEGMENTS.has(base)
    ? `${base}-team`
    : base;
  if (!taken.has(candidate)) {
    return candidate;
  }

  if (fallbackId) {
    const withId = `${candidate}-${fallbackId.replace(/-/g, "").slice(0, 8)}`;
    if (!taken.has(withId)) {
      return withId;
    }
  }

  let n = 2;
  while (taken.has(`${candidate}-${n}`)) {
    n += 1;
  }
  return `${candidate}-${n}`;
}

export function myTeamPath(leagueId: string) {
  return `/league/${leagueId}/team`;
}

export function leagueTeamPath(leagueId: string, teamId: string) {
  return `/league/${leagueId}/team/${teamId}`;
}

function setComposerIds(
  search: URLSearchParams,
  key: string,
  value?: string | string[],
) {
  if (value == null) {
    return;
  }
  const ids = (Array.isArray(value) ? value : [value])
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length > 0) {
    search.set(key, ids.join(","));
  }
}

export function parseTradeComposerIds(raw?: string | null) {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function tradeComposerPath(
  leagueId: string,
  params?: {
    with?: string;
    want?: string | string[];
    offer?: string | string[];
    counter?: string;
  },
) {
  const base = `/league/${leagueId}/trades/new`;
  if (!params) {
    return base;
  }
  const search = new URLSearchParams();
  if (params.with) {
    search.set("with", params.with);
  }
  setComposerIds(search, "want", params.want);
  setComposerIds(search, "offer", params.offer);
  if (params.counter) {
    search.set("counter", params.counter);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function leagueMatchupPath(leagueId: string, matchupId: string) {
  return `/league/${leagueId}/scores/${matchupId}`;
}

/** Other managers' team pages under `/league/{id}/team/{teamId}`. */
export function isLeagueTeamPathname(pathname: string, leagueBase: string) {
  const prefix = `${leagueBase}/team/`;
  return pathname.startsWith(prefix) && pathname.length > prefix.length;
}

type UserNameSource = {
  email?: string;
  user_metadata?: {
    first_name?: string;
    full_name?: string;
    name?: string;
  };
};

export function getDefaultTeamName(
  user: UserNameSource,
  displayName?: string | null,
): string {
  const firstName =
    user.user_metadata?.first_name?.trim() ||
    user.user_metadata?.full_name?.trim().split(/\s+/)[0] ||
    user.user_metadata?.name?.trim().split(/\s+/)[0] ||
    displayName?.trim().split(/\s+/)[0] ||
    user.email?.split("@")[0];

  return firstName ? `${firstName}'s Team` : "My Team";
}

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += INVITE_ALPHABET[bytes[i]! % INVITE_ALPHABET.length];
  }
  return code;
}
