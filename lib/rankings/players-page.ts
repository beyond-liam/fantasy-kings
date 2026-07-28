/** Default page size for rankings / league players tables (server-hydrated). */
export const PLAYERS_PAGE_SIZE = 50;

export function parsePlayersPage(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function playersPageOffset(page: number, pageSize = PLAYERS_PAGE_SIZE) {
  return Math.max(0, (page - 1) * pageSize);
}
