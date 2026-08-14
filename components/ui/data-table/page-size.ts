export const DATA_TABLE_PAGE_SIZES = [10, 25, 50] as const;

export type DataTablePageSize = (typeof DATA_TABLE_PAGE_SIZES)[number];

export const DEFAULT_DATA_TABLE_PAGE_SIZE: DataTablePageSize = 25;

const PAGE_SIZE_SET = new Set<number>(DATA_TABLE_PAGE_SIZES);

export function parseDataTablePageSize(
  raw?: string | null,
): DataTablePageSize {
  const n = Number(raw);
  if (PAGE_SIZE_SET.has(n)) {
    return n as DataTablePageSize;
  }
  return DEFAULT_DATA_TABLE_PAGE_SIZE;
}

export function dataTablePageSizeQueryValue(
  pageSize: number,
): string | null {
  return pageSize === DEFAULT_DATA_TABLE_PAGE_SIZE ? null : String(pageSize);
}
