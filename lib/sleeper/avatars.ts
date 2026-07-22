const SLEEPER_CDN = "https://sleepercdn.com";

/** Full-size NFL player headshot from Sleeper CDN. */
export function getSleeperPlayerAvatarUrl(sleeperId: string): string {
  return `${SLEEPER_CDN}/content/nfl/players/${sleeperId}.jpg`;
}

/** Thumbnail NFL player headshot from Sleeper CDN. */
export function getSleeperPlayerAvatarThumbUrl(sleeperId: string): string {
  return `${SLEEPER_CDN}/content/nfl/players/thumb/${sleeperId}.jpg`;
}

/** Team logo (useful for DEF rows). */
export function getSleeperTeamLogoUrl(nflTeam: string): string {
  return `${SLEEPER_CDN}/images/team_logos/nfl/${nflTeam.toLowerCase()}.png`;
}

export function getPlayerAvatarUrl(options: {
  sleeperId: string | null | undefined;
  primaryPositionId: string;
  nflTeam: string | null | undefined;
}): string | null {
  const { sleeperId, primaryPositionId, nflTeam } = options;

  if (primaryPositionId === "DEF" && nflTeam) {
    return getSleeperTeamLogoUrl(nflTeam);
  }

  if (!sleeperId) {
    return null;
  }

  return getSleeperPlayerAvatarThumbUrl(sleeperId);
}

export function getPlayerInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}
