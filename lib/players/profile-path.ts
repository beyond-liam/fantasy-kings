const PLAYER_PROFILE_PATH =
  /^\/(?:players\/[^/]+|league\/[^/]+\/players\/[^/]+)\/?$/;

/**
 * Canonical href for a player profile page.
 * League-scoped paths keep the league sidebar with Players active.
 */
export function playerProfileHref(input: {
  playerId: string;
  leagueSlug?: string | null;
  season?: string | null;
}): string {
  const slug = input.leagueSlug?.trim() || null;
  const params = new URLSearchParams();
  if (input.season) {
    params.set("season", input.season);
  }

  const query = params.toString();
  const suffix = query ? `?${query}` : "";

  if (slug) {
    return `/league/${slug}/players/${input.playerId}${suffix}`;
  }

  return `/players/${input.playerId}${suffix}`;
}

export function isPlayerProfilePath(pathname: string): boolean {
  return PLAYER_PROFILE_PATH.test(pathname);
}

/** League Players list, or global Rankings when there is no league. */
export function playerProfileFallbackHref(leagueSlug?: string | null): string {
  const slug = leagueSlug?.trim();
  if (slug) {
    return `/league/${slug}/players`;
  }
  return "/rankings";
}

/**
 * Same-origin page that opened this profile. Null when the referrer is
 * missing, cross-origin, or another player profile (season switches).
 */
export function playerProfileReturnFromReferrer(input: {
  referrer: string | null | undefined;
  origin: string;
}): string | null {
  const raw = input.referrer?.trim();
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    if (url.origin !== input.origin || isPlayerProfilePath(url.pathname)) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
