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
