import { resolveIdpPrimaryPosition } from "@/lib/leagues/idp-positions";

const OFFENSE_POSITIONS = ["QB", "RB", "WR", "TE", "K"] as const;

/**
 * Resolve a Sleeper player into a Fantasy Kings `positions.id`.
 * Team DEF stays separate from individual defenders.
 */
export function resolveSleeperPrimaryPosition(player: {
  active: boolean;
  position: string | null;
  fantasy_positions: string[] | null;
  team: string | null;
  hasDisplayName: boolean;
  depth_chart_position?: string | null;
}): string | null {
  if (!player.active || !player.hasDisplayName) {
    return null;
  }

  const fantasyPositions = player.fantasy_positions ?? [];

  if (fantasyPositions.includes("DEF")) {
    return player.team ? "DEF" : null;
  }

  if (
    player.position &&
    OFFENSE_POSITIONS.includes(
      player.position as (typeof OFFENSE_POSITIONS)[number],
    )
  ) {
    return player.team ? player.position : null;
  }

  const idp = resolveIdpPrimaryPosition(
    player.position,
    player.depth_chart_position,
  );
  if (idp) {
    return player.team ? idp : null;
  }

  for (const position of OFFENSE_POSITIONS) {
    if (fantasyPositions.includes(position)) {
      return player.team ? position : null;
    }
  }

  return null;
}
