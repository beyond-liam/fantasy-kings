"use client";

import { useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

import { PlayerAvatar } from "@/components/rankings/player-avatar";
import {
  DataTable,
  DataTableColumnHeader,
  useDataTable,
} from "@/components/ui/data-table";
import type { OverviewRosterCompareRow } from "@/lib/players/overview-metrics";
import { cn } from "@/lib/utils";

type RosterCompareTableProps = {
  rows: OverviewRosterCompareRow[];
  /** Show RB usage columns (carry share, YPC). */
  showRbUsage?: boolean;
  /** Position startable cutoff for the T# column (WR 24, TE 12). */
  startableThreshold?: number;
};

const PLACEHOLDER = "—";

/** Sticky pin only — row paint is applied to every `td` so colors stay in sync. */
const STICKY_PLAYER_CELL =
  "sticky left-0 z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]";
const STICKY_PLAYER_HEADER =
  "sticky left-0 z-30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]";

/** Same surface on all cells (incl. sticky) — default + hover. */
const ROW_CELLS =
  "[&>td]:bg-background [&>td]:group-hover/tr:bg-muted";
/** Info accent via ::before (sticky already positions abs children — do not add `relative`). */
const VIEWED_ROW_CELLS =
  "[&>td]:bg-[color-mix(in_oklab,var(--primary)_12%,var(--background))] [&>td]:group-hover/tr:bg-[color-mix(in_oklab,var(--primary)_12%,var(--background))] [&>td:first-child]:before:pointer-events-none [&>td:first-child]:before:absolute [&>td:first-child]:before:inset-y-0 [&>td:first-child]:before:left-0 [&>td:first-child]:before:z-10 [&>td:first-child]:before:w-[3px] [&>td:first-child]:before:bg-info [&>td:first-child]:before:content-['']";

function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
) {
  const aMissing = a == null || !Number.isFinite(a);
  const bMissing = b == null || !Number.isFinite(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return a - b;
}

function formatPts(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return PLACEHOLDER;
  return value.toFixed(digits);
}

function formatPct(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return PLACEHOLDER;
  return `${value.toFixed(digits)}%`;
}

function formatFinish(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return PLACEHOLDER;
  return `#${value.toFixed(1)}`;
}

function formatSos(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return PLACEHOLDER;
  return `#${Math.round(value)}`;
}

/** Delta of `rowValue - viewedValue`. Success when this row is better. */
function deltaClass(delta: number, higherIsBetter: boolean) {
  if (delta === 0) return "text-muted-foreground";
  const better = higherIsBetter ? delta > 0 : delta < 0;
  return better ? "text-success" : "text-destructive";
}

function formatDelta(
  delta: number,
  kind: "pts" | "pct" | "finish" | "int" | "ypc",
) {
  const sign = delta > 0 ? "+" : "";
  if (kind === "pct") return `${sign}${delta.toFixed(0)}%`;
  if (kind === "finish" || kind === "int") {
    return `${sign}${delta.toFixed(kind === "finish" ? 1 : 0)}`;
  }
  if (kind === "ypc") return `${sign}${delta.toFixed(1)}`;
  return `${sign}${delta.toFixed(1)}`;
}

function MetricWithDelta({
  display,
  delta,
  higherIsBetter,
  showDelta,
  deltaKind,
}: {
  display: string;
  delta: number | null;
  higherIsBetter: boolean;
  showDelta: boolean;
  deltaKind: "pts" | "pct" | "finish" | "int" | "ypc";
}) {
  return (
    <div className="flex flex-col gap-0.5 leading-tight">
      <span className="tabular-nums">{display}</span>
      {showDelta ? (
        delta != null && Number.isFinite(delta) ? (
          <span
            className={cn(
              "text-[10px] tabular-nums",
              deltaClass(delta, higherIsBetter),
            )}
          >
            {formatDelta(delta, deltaKind)}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">{PLACEHOLDER}</span>
        )
      ) : null}
    </div>
  );
}

function numericColumn(options: {
  id: keyof OverviewRosterCompareRow;
  title: string;
  tooltip: string;
  higherIsBetter: boolean;
  deltaKind: "pts" | "pct" | "finish" | "int" | "ypc";
  format: (value: number | null) => string;
  viewed: OverviewRosterCompareRow | undefined;
  width?: number;
}): ColumnDef<OverviewRosterCompareRow> {
  const {
    id,
    title,
    tooltip,
    higherIsBetter,
    deltaKind,
    format,
    viewed,
    width,
  } = options;
  return {
    id,
    accessorFn: (row) => row[id] as number | null,
    enableSorting: true,
    sortingFn: (a, b) =>
      compareNullableNumber(
        a.getValue<number | null>(id),
        b.getValue<number | null>(id),
      ),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={title} tooltip={tooltip} />
    ),
    cell: ({ row }) => {
      const value = row.original[id] as number | null;
      const viewedValue = viewed
        ? (viewed[id] as number | null)
        : null;
      const delta =
        !row.original.isViewed && value != null && viewedValue != null
          ? value - viewedValue
          : null;
      return (
        <MetricWithDelta
          display={format(value)}
          delta={delta}
          higherIsBetter={higherIsBetter}
          showDelta={!row.original.isViewed}
          deltaKind={deltaKind}
        />
      );
    },
    meta: {
      cellClassName: "tabular-nums align-top",
      ...(width != null ? { width } : {}),
    },
  };
}

export function RosterCompareTable({
  rows,
  showRbUsage = false,
  startableThreshold = 12,
}: RosterCompareTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "fptsPerGame", desc: true },
  ]);

  const viewed = useMemo(
    () => rows.find((row) => row.isViewed),
    [rows],
  );

  const columns = useMemo<ColumnDef<OverviewRosterCompareRow>[]>(() => {
    const startableTitle = `T${startableThreshold}%`;
    const cols: ColumnDef<OverviewRosterCompareRow>[] = [
      {
        id: "player",
        accessorFn: (row) => row.name,
        enableSorting: true,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Player" />
        ),
        cell: ({ row }) => {
          const player = row.original;
          return (
            <div className="flex min-w-0 items-start gap-2">
              <PlayerAvatar
                fullName={player.name}
                sleeperId={player.sleeperId}
                primaryPositionId={player.primaryPositionId}
                nflTeam={player.nflTeam}
                size="sm"
              />
              <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
                <span
                  className={cn(
                    "truncate text-pretty font-medium",
                    player.isViewed && "text-foreground",
                  )}
                >
                  {player.name}
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {[player.slotLabel, player.nflTeam]
                    .filter(Boolean)
                    .join(" · ") ||
                    (player.isViewed ? "This player" : PLACEHOLDER)}
                </span>
              </div>
            </div>
          );
        },
        meta: {
          width: 176,
          // Skip DataTable `sticky: "left"` — it adds translucent max-md:bg-muted/50.
          headerClassName: STICKY_PLAYER_HEADER,
          cellClassName: cn("align-top min-w-[11rem]", STICKY_PLAYER_CELL),
        },
      },
      numericColumn({
        id: "gamesPlayed",
        title: "GP",
        tooltip: "Games played",
        higherIsBetter: true,
        deltaKind: "int",
        format: (v) => (v == null ? PLACEHOLDER : String(Math.round(v))),
        viewed,
        width: 56,
      }),
      numericColumn({
        id: "fptsPerGame",
        title: "FPts/G",
        tooltip: "Average fantasy points per game",
        higherIsBetter: true,
        deltaKind: "pts",
        format: (v) => formatPts(v),
        viewed,
        width: 72,
      }),
      numericColumn({
        id: "totalFpts",
        title: "FPts",
        tooltip: "Total fantasy points",
        higherIsBetter: true,
        deltaKind: "pts",
        format: (v) => formatPts(v, 1),
        viewed,
        width: 68,
      }),
      numericColumn({
        id: "homeAvg",
        title: "Home",
        tooltip: "Average points at home",
        higherIsBetter: true,
        deltaKind: "pts",
        format: (v) => formatPts(v),
        viewed,
        width: 64,
      }),
      numericColumn({
        id: "awayAvg",
        title: "Away",
        tooltip: "Average points on the road",
        higherIsBetter: true,
        deltaKind: "pts",
        format: (v) => formatPts(v),
        viewed,
        width: 64,
      }),
      numericColumn({
        id: "floor",
        title: "Flr",
        tooltip: "Floor (15th percentile weekly FPts)",
        higherIsBetter: true,
        deltaKind: "pts",
        format: (v) => formatPts(v),
        viewed,
        width: 56,
      }),
      numericColumn({
        id: "median",
        title: "Med",
        tooltip: "Median weekly FPts",
        higherIsBetter: true,
        deltaKind: "pts",
        format: (v) => formatPts(v),
        viewed,
        width: 56,
      }),
      numericColumn({
        id: "ceiling",
        title: "Ceil",
        tooltip: "Ceiling (85th percentile weekly FPts)",
        higherIsBetter: true,
        deltaKind: "pts",
        format: (v) => formatPts(v),
        viewed,
        width: 56,
      }),
      numericColumn({
        id: "consistencyScore",
        title: "Cons",
        tooltip: "Scoring consistency (0–100)",
        higherIsBetter: true,
        deltaKind: "int",
        format: (v) => (v == null ? PLACEHOLDER : String(Math.round(v))),
        viewed,
        width: 56,
      }),
      numericColumn({
        id: "avgWeeklyFinish",
        title: "Fin",
        tooltip: "Average weekly finish at position (lower is better)",
        higherIsBetter: false,
        deltaKind: "finish",
        format: (v) => formatFinish(v),
        viewed,
        width: 64,
      }),
      numericColumn({
        id: "startablePct",
        title: startableTitle,
        tooltip: `Share of weeks finishing top ${startableThreshold} at position`,
        higherIsBetter: true,
        deltaKind: "pct",
        format: (v) => formatPct(v, 0),
        viewed,
        width: 64,
      }),
    ];

    if (showRbUsage) {
      cols.push(
        numericColumn({
          id: "carrySharePct",
          title: "Carry%",
          tooltip: "Team carry share",
          higherIsBetter: true,
          deltaKind: "pct",
          format: (v) => formatPct(v, 0),
          viewed,
          width: 68,
        }),
        numericColumn({
          id: "ypc",
          title: "YPC",
          tooltip: "Yards per carry",
          higherIsBetter: true,
          deltaKind: "ypc",
          format: (v) => formatPts(v, 1),
          viewed,
          width: 56,
        }),
      );
    }

    cols.push(
      numericColumn({
        id: "remainingSosRank",
        title: "rSOS",
        tooltip:
          "Remaining strength of schedule (avg matchup rank; 1 = hardest)",
        higherIsBetter: false,
        deltaKind: "int",
        format: (v) => formatSos(v),
        viewed,
        width: 64,
      }),
    );

    return cols;
  }, [showRbUsage, startableThreshold, viewed]);

  const table = useDataTable({
    data: rows,
    columns,
    sorting,
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    pageSize: Math.max(rows.length, 1),
  });

  return (
    <DataTable
      table={table}
      showPagination={false}
      emptyMessage="No roster mates at this position to compare."
      layout="fixed"
      headerClassName="bg-background font-semibold"
      getRowClassName={(row) =>
        cn(ROW_CELLS, row.original.isViewed && VIEWED_ROW_CELLS)
      }
    />
  );
}
