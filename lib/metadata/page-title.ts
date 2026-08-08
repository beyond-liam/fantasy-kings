/**
 * Browser tab title helpers.
 * Root layout appends `| Fantasy Kings` outside league routes.
 * League layout uses `| {league name}` for nested pages instead.
 */

export function formatAwayAtHome(awayName: string, homeName: string): string {
  return `${awayName} @ ${homeName}`;
}
