"use client";

import { useMemo, useState } from "react";
import {
  CarTaxiFrontIcon,
  Hospital01Icon,
  UserBlock01Icon,
  UserCheck01Icon,
  UserDollarIcon,
  UserMinus01Icon,
  UserSwitchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TABLE_SHELL_CLASSNAME } from "@/components/ui/table";
import type { FeedActivityType } from "@/lib/leagues/activity-log";
import type { LeagueActivityRow } from "@/lib/queries/activity";
import { cn } from "@/lib/utils";

type LeagueActivityFeedProps = {
  items: LeagueActivityRow[];
};

const ALL_TYPES = "all";
const PAGE_SIZE = 20;

const ACTIVITY_META: Record<
  FeedActivityType,
  {
    label: string;
    icon: IconSvgElement;
    tone: "success" | "destructive";
  }
> = {
  player_added: {
    label: "Added",
    icon: UserCheck01Icon,
    tone: "success",
  },
  player_dropped: {
    label: "Dropped",
    icon: UserMinus01Icon,
    tone: "destructive",
  },
  trade_completed: {
    label: "Trade completed",
    icon: UserSwitchIcon,
    tone: "success",
  },
  trade_vetoed: {
    label: "Trade vetoed",
    icon: UserBlock01Icon,
    tone: "destructive",
  },
  ir_added: {
    label: "IR added",
    icon: Hospital01Icon,
    tone: "destructive",
  },
  ir_removed: {
    label: "IR removed",
    icon: Hospital01Icon,
    tone: "success",
  },
  waiver_awarded: {
    label: "Claimed",
    icon: UserDollarIcon,
    tone: "success",
  },
  taxi_added: {
    label: "Taxi added",
    icon: CarTaxiFrontIcon,
    tone: "destructive",
  },
  taxi_removed: {
    label: "Taxi removed",
    icon: CarTaxiFrontIcon,
    tone: "success",
  },
};

const ACTIVITY_TONE_CLASS: Record<"success" | "destructive", string> = {
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
};

function resolveActivitySummary(item: LeagueActivityRow): string {
  const liveName = item.teamName?.trim();
  if (!liveName) return item.summary;

  const playerName =
    item.playerName?.trim() || item.metadata?.playerName?.trim() || null;
  const meta = item.metadata;

  if (playerName) {
    switch (item.type) {
      case "player_added":
        return `${liveName} added ${playerName}`;
      case "player_dropped":
        return `${liveName} dropped ${playerName}`;
      case "ir_added":
        return `${liveName} added ${playerName} to IR`;
      case "ir_removed":
        return `${liveName} removed ${playerName} from IR`;
      case "taxi_added":
        return `${liveName} added ${playerName} to taxi`;
      case "taxi_removed":
        return `${liveName} removed ${playerName} from taxi`;
      case "waiver_awarded": {
        const bidPart =
          meta?.waiverType === "faab" && meta.bid != null
            ? ` for $${meta.bid}`
            : "";
        const dropPart = meta?.dropPlayerName
          ? ` (dropped ${meta.dropPlayerName})`
          : "";
        return `${liveName} claimed ${playerName}${bidPart}${dropPart}.`;
      }
      default:
        break;
    }
  }

  const staleName = meta?.teamName?.trim();
  if (staleName && staleName !== liveName && item.summary.includes(staleName)) {
    return item.summary.split(staleName).join(liveName);
  }

  return item.summary;
}

function formatActivityTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function LeagueActivityFeed({ items }: LeagueActivityFeedProps) {
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [page, setPage] = useState(0);

  const filterItems = useMemo(() => {
    const present = new Set(items.map((item) => item.type));
    return [
      { value: ALL_TYPES, label: "All types" },
      ...Object.entries(ACTIVITY_META)
        .filter(([type]) => present.has(type as FeedActivityType))
        .map(([type, meta]) => ({
          value: type,
          label: meta.label,
        })),
    ];
  }, [items]);

  const filtered =
    typeFilter === ALL_TYPES
      ? items
      : items.filter((item) => item.type === typeFilter);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Activity
        </h1>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No activity yet</EmptyTitle>
            <EmptyDescription>
              Adds, drops, trades, waivers, IR, and taxi moves will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Activity
        </h1>
        <Select
          items={filterItems}
          value={typeFilter}
          onValueChange={(value) => {
            if (value) {
              setTypeFilter(value);
              setPage(0);
            }
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-56 shrink-0"
            aria-label="Filter activity by type"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end" alignItemWithTrigger={false}>
            <SelectGroup>
              {filterItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No activity for this type.
        </p>
      ) : (
        <>
          <ul className={cn(TABLE_SHELL_CLASSNAME, "divide-y")}>
            {pageItems.map((item) => {
              const meta = ACTIVITY_META[item.type as FeedActivityType];
              if (!meta) return null;
              return (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                      ACTIVITY_TONE_CLASS[meta.tone],
                    )}
                  >
                    <HugeiconsIcon
                      icon={meta.icon}
                      strokeWidth={1.5}
                      className="size-5"
                    />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-sm text-pretty">
                      {resolveActivitySummary(item)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatActivityTime(item.createdAt)} UTC · {meta.label}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <ListPagination
            page={safePage}
            pageCount={pageCount}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            label={{ singular: "event", plural: "events" }}
          />
        </>
      )}
    </div>
  );
}
