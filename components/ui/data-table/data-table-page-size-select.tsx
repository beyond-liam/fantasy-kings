"use client";

import {
  DATA_TABLE_PAGE_SIZES,
  type DataTablePageSize,
} from "@/components/ui/data-table/page-size";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE_ITEMS = DATA_TABLE_PAGE_SIZES.map((size) => ({
  label: String(size),
  value: String(size),
}));

type DataTablePageSizeSelectProps = {
  pageSize: number;
  totalCount: number;
  onPageSizeChange: (pageSize: DataTablePageSize) => void;
};

export function DataTablePageSizeSelect({
  pageSize,
  totalCount,
  onPageSizeChange,
}: DataTablePageSizeSelectProps) {
  const resultLabel = totalCount === 1 ? "result" : "results";

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <span>
        Found{" "}
        <span className="font-medium tabular-nums text-foreground">
          {totalCount}
        </span>{" "}
        {resultLabel}. Showing:
      </span>
      <Select
        items={PAGE_SIZE_ITEMS}
        value={String(pageSize)}
        onValueChange={(value) => {
          if (!value) return;
          const next = Number(value) as DataTablePageSize;
          if (!DATA_TABLE_PAGE_SIZES.includes(next)) return;
          onPageSizeChange(next);
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label="Rows per page"
          className="w-16 shrink-0 tabular-nums"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="center" className="w-20 min-w-20">
          <SelectGroup>
            {DATA_TABLE_PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                <span className="whitespace-nowrap">{size}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <span>per page.</span>
    </div>
  );
}
