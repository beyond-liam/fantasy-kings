import { DEFAULT_DATA_TABLE_PAGE_SIZE } from "@/components/ui/data-table/page-size";

/** Default page size for rankings / league players tables (server-hydrated). */
export const PLAYERS_PAGE_SIZE = DEFAULT_DATA_TABLE_PAGE_SIZE;

export function parsePlayersPage(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function playersPageOffset(page: number, pageSize: number = PLAYERS_PAGE_SIZE) {
  return Math.max(0, (page - 1) * pageSize);
}
