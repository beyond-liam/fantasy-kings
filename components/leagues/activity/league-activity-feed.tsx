"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CarTaxiFrontIcon,
  Hospital01Icon,
  RefreshIcon,
  Settings01Icon,
  StudentCardIcon,
  Tick02Icon,
  LoyaltyCardIcon,
  UserBlock01Icon,
  UserCheck01Icon,
  UserDollarIcon,
  UserMinus01Icon,
  UserSwitchIcon,
  Activity01Icon,
  ArrowTurnBackwardIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FeedActivityType } from "@/lib/leagues/activity-log";
import { formatSettingsActivityLabel } from "@/lib/leagues/settings-activity-labels";
import {
  formatClaimResolutionFailLabel,
  type ClaimResolutionEntry,
} from "@/lib/leagues/waivers/claim-resolution";
import type { LeagueActivityRow } from "@/lib/queries/activity";
import { cn } from "@/lib/utils";

type LeagueActivityFeedProps = {
  items: LeagueActivityRow[];
  leagueSlug: string;
};

const TRADE_ACTIVITY_TYPES = new Set<FeedActivityType>([
  "trade_accepted",
  "trade_completed",
  "trade_vetoed",
  "trade_cancelled",
]);

/** Drop trailing "(…)" from stored summaries (e.g. league review, veto counts). */
function stripTrailingParenthetical(summary: string): string {
  return summary.replace(/\s*\([^)]+\)(?=\.?$)/, "").replace(/\s+\./, ".");
}

/** Activity headings are sentence fragments — no terminal period. */
function stripTrailingPeriod(summary: string): string {
  return summary.replace(/\.+$/, "").trimEnd();
}

const ALL_TYPES = "all";
const PAGE_SIZE = 20;

/** Condensed filter buckets for the activity select. */
const ACTIVITY_FILTER_GROUPS = [
  {
    value: "draft",
    label: "Draft activity",
    types: ["draft_pick", "draft_pick_reverted"],
  },
  {
    value: "trades",
    label: "Trades",
    types: [
      "trade_accepted",
      "trade_completed",
      "trade_vetoed",
      "trade_cancelled",
    ],
  },
  {
    value: "waivers",
    label: "Waivers",
    types: ["waiver_awarded"],
  },
  {
    value: "roster",
    label: "Roster",
    types: [
      "player_added",
      "player_dropped",
      "ir_added",
      "ir_removed",
      "taxi_added",
      "taxi_removed",
      "keepers_set",
    ],
  },
  {
    value: "league",
    label: "Settings changes",
    types: ["settings_updated", "score_corrected", "member_removed"],
  },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  types: readonly FeedActivityType[];
}>;

type ActivityFilterValue =
  | typeof ALL_TYPES
  | (typeof ACTIVITY_FILTER_GROUPS)[number]["value"];

const FILTER_TYPES_BY_VALUE: Record<string, ReadonlySet<FeedActivityType>> =
  Object.fromEntries(
    ACTIVITY_FILTER_GROUPS.map((group) => [
      group.value,
      new Set<FeedActivityType>(group.types),
    ]),
  );

const ACTIVITY_META: Record<
  FeedActivityType,
  {
    label: string;
    icon: IconSvgElement;
    tone: "success" | "destructive" | "info" | "warning";
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
  ir_added: {
    label: "IR added",
    icon: Hospital01Icon,
    tone: "warning",
  },
  ir_removed: {
    label: "IR removed",
    icon: Hospital01Icon,
    tone: "success",
  },
  taxi_added: {
    label: "Taxi squad",
    icon: CarTaxiFrontIcon,
    tone: "warning",
  },
  taxi_removed: {
    label: "Active roster",
    icon: CarTaxiFrontIcon,
    tone: "success",
  },
  waiver_awarded: {
    label: "Claimed",
    icon: UserDollarIcon,
    tone: "success",
  },
  trade_accepted: {
    label: "Trade agreed",
    icon: UserSwitchIcon,
    tone: "success",
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
  trade_cancelled: {
    label: "Trade cancelled",
    icon: UserBlock01Icon,
    tone: "destructive",
  },
  settings_updated: {
    label: "Settings",
    icon: Settings01Icon,
    tone: "info",
  },
  score_corrected: {
    label: "Score corrected",
    icon: RefreshIcon,
    tone: "info",
  },
  member_removed: {
    label: "Member removed",
    icon: UserMinus01Icon,
    tone: "destructive",
  },
  draft_pick: {
    label: "Drafted",
    icon: StudentCardIcon,
    tone: "success",
  },
  draft_pick_reverted: {
    label: "Pick reverted",
    icon: ArrowTurnBackwardIcon,
    tone: "destructive",
  },
  keepers_set: {
    label: "Keepers",
    icon: LoyaltyCardIcon,
    tone: "info",
  },
};

const ACTIVITY_TONE_CLASS: Record<
  "success" | "destructive" | "info" | "warning",
  string
> = {
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
};

function resolveActivityTypeLabel(item: LeagueActivityRow): string {
  if (
    item.type === "draft_pick" &&
    item.metadata?.draftSource === "commissioner"
  ) {
    return "Drafted by Commissioner";
  }
  return ACTIVITY_META[item.type as FeedActivityType]?.label ?? "Activity";
}

function resolveActivitySummary(item: LeagueActivityRow): string {
  if (item.type === "settings_updated") {
    const label = formatSettingsActivityLabel(
      item.metadata?.settingsLabel?.trim() || "league settings",
    );
    return stripTrailingPeriod(`Commissioner updated ${label}`);
  }

  const liveName = item.teamName?.trim();
  if (!liveName) {
    return stripTrailingPeriod(
      TRADE_ACTIVITY_TYPES.has(item.type)
        ? stripTrailingParenthetical(item.summary)
        : item.summary,
    );
  }

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
        return `${liveName} moved ${playerName} to their taxi squad`;
      case "taxi_removed":
        return `${liveName} moved ${playerName} to their active roster`;
      case "waiver_awarded": {
        const bidPart =
          meta?.waiverType === "faab" && meta.bid != null
            ? ` for $${meta.bid}`
            : "";
        // Legacy rows bundled the drop; new awards log a separate player_dropped row.
        const dropPart = meta?.dropPlayerName
          ? ` (dropped ${meta.dropPlayerName})`
          : "";
        return `${liveName} claimed ${playerName}${bidPart}${dropPart}`;
      }
      case "draft_pick": {
        const pickPart =
          meta?.overall != null ? ` · Pick #${meta.overall}` : "";
        const autopickPart =
          meta?.draftSource === "autopick" ? " (autopick)" : "";
        return `${liveName} drafted ${playerName}${pickPart}${autopickPart}`;
      }
      case "draft_pick_reverted": {
        const pickPart =
          meta?.overall != null ? ` · Pick #${meta.overall}` : "";
        return `${liveName} pick of ${playerName} reverted${pickPart}`;
      }
      default:
        break;
    }
  }

  if (item.type === "keepers_set") {
    const count = meta?.keeperCount;
    if (typeof count === "number" && Number.isFinite(count)) {
      return `${liveName} set ${count} keeper${count === 1 ? "" : "s"}`;
    }
  }

  if (item.type === "member_removed") {
    const removed =
      meta?.removedDisplayName?.trim() || meta?.teamName?.trim() || "A manager";
    return `${removed} was removed from the league`;
  }

  const staleName = meta?.teamName?.trim();
  let summary = item.summary;
  if (staleName && staleName !== liveName && summary.includes(staleName)) {
    summary = summary.split(staleName).join(liveName);
  }

  if (TRADE_ACTIVITY_TYPES.has(item.type)) {
    return stripTrailingPeriod(stripTrailingParenthetical(summary));
  }

  return stripTrailingPeriod(summary);
}

function formatClaimResolutionLine(
  entry: ClaimResolutionEntry,
  waiverType: "priority" | "faab" | null | undefined,
) {
  const detail =
    waiverType === "faab"
      ? `$${entry.bid ?? 0}`
      : `#${entry.waiverPriority}`;
  const failLabel =
    entry.status === "illegal_roster"
      ? "illegal roster"
      : entry.status === "lost"
        ? formatClaimResolutionFailLabel(entry.failReason)
        : null;
  // Don't clutter winning/lost-outbid rows with "Outbid" / "Lower waiver priority"
  const showFail =
    entry.status === "illegal_roster" ||
    (failLabel != null &&
      failLabel !== "Outbid" &&
      failLabel !== "Lower waiver priority");
  return showFail ? `${entry.teamName} ${detail} - ${failLabel}` : `${entry.teamName} ${detail}`;
}

function ClaimResolutionMeta({ item }: { item: LeagueActivityRow }) {
  const resolution = item.metadata?.claimResolution ?? [];
  const claimCount = item.metadata?.claimCount ?? resolution.length;
  if (claimCount <= 0 && resolution.length === 0) {
    return null;
  }
  const count = claimCount || resolution.length;
  const waiverType = item.metadata?.waiverType;

  if (resolution.length === 0) {
    return (
      <span>
        · Total claims: {count}
      </span>
    );
  }

  return (
    <>
      {" · "}
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="underline decoration-dotted underline-offset-2 hover:text-foreground"
            />
          }
        >
          Total claims: {count}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="flex max-w-xs flex-col items-start gap-1.5 bg-foreground px-3 py-2 text-left text-background"
        >
          <p className="w-full text-left font-semibold">Claim Resolution</p>
          <ul className="flex flex-col gap-1">
            {resolution.map((entry) => {
              const line = formatClaimResolutionLine(entry, waiverType);
              const illegal = entry.status === "illegal_roster";
              return (
                <li
                  key={`${entry.teamId}-${entry.waiverPriority}-${entry.bid}`}
                  className={cn(
                    "flex items-start gap-1.5",
                    illegal && "line-through opacity-70",
                  )}
                >
                  <span className="min-w-0 flex-1 text-pretty">{line}</span>
                  {entry.status === "won" ? (
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      strokeWidth={2}
                      className="size-3.5 shrink-0"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </TooltipContent>
      </Tooltip>
    </>
  );
}

function formatActivityTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function LeagueActivityFeed({
  items,
  leagueSlug,
}: LeagueActivityFeedProps) {
  const [typeFilter, setTypeFilter] = useState<ActivityFilterValue>(ALL_TYPES);
  const [page, setPage] = useState(0);
  const [settingsDetail, setSettingsDetail] =
    useState<LeagueActivityRow | null>(null);

  const filterItems = useMemo(() => {
    const present = new Set(items.map((item) => item.type));
    return [
      { value: ALL_TYPES, label: "View all activity" },
      ...ACTIVITY_FILTER_GROUPS.filter((group) =>
        group.types.some((type) => present.has(type)),
      ).map((group) => ({
        value: group.value,
        label: group.label,
      })),
    ];
  }, [items]);

  const filtered =
    typeFilter === ALL_TYPES
      ? items
      : items.filter((item) =>
          FILTER_TYPES_BY_VALUE[typeFilter]?.has(
            item.type as FeedActivityType,
          ),
        );

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
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Activity01Icon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No activity yet</EmptyTitle>
            <EmptyDescription>
              Roster moves, claims, trades, settings changes, and membership
              updates will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-balance">
        Activity
      </h1>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          items={filterItems}
          value={typeFilter}
          onValueChange={(value) => {
            if (value == null) return;
            if (
              value === ALL_TYPES ||
              ACTIVITY_FILTER_GROUPS.some((group) => group.value === value)
            ) {
              setTypeFilter(value);
              setPage(0);
            }
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-44 shrink-0"
            aria-label="Filter activity by category"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
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
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Activity01Icon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No activity for this category.</EmptyTitle>
            <EmptyDescription>
              Try another filter or check back after more league events.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <TooltipProvider>
          <ul className={cn(TABLE_SHELL_CLASSNAME, "divide-y")}>
            {pageItems.map((item) => {
              const meta = ACTIVITY_META[item.type as FeedActivityType];
              if (!meta) return null;
              const isSettings = item.type === "settings_updated";
              const tradeHref =
                TRADE_ACTIVITY_TYPES.has(item.type) && item.tradeId
                  ? `/league/${leagueSlug}/trades#trade-${item.tradeId}`
                  : null;
              const rowClassName =
                "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none";
              const body = (
                <>
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
                  <div className="flex min-w-0 flex-col gap-1 text-left">
                    <p className="text-sm text-pretty">
                      {resolveActivitySummary(item)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatActivityTime(item.createdAt)} UTC ·{" "}
                      {resolveActivityTypeLabel(item)}
                      {item.type === "waiver_awarded" ? (
                        <ClaimResolutionMeta item={item} />
                      ) : null}
                    </p>
                  </div>
                </>
              );
              return (
                <li key={item.id}>
                  {isSettings ? (
                    <button
                      type="button"
                      className={rowClassName}
                      onClick={() => setSettingsDetail(item)}
                    >
                      {body}
                    </button>
                  ) : tradeHref ? (
                    <Link href={tradeHref} className={rowClassName}>
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 px-4 py-3">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          </TooltipProvider>
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

      <SettingsChangesDialog
        item={settingsDetail}
        open={settingsDetail != null}
        onOpenChange={(open) => {
          if (!open) setSettingsDetail(null);
        }}
      />
    </div>
  );
}

function SettingsChangesDialog({
  item,
  open,
  onOpenChange,
}: {
  item: LeagueActivityRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const label = formatSettingsActivityLabel(
    item?.metadata?.settingsLabel?.trim() || "league settings",
  );
  // Preset switches are implied by the rule diffs — don't surface them.
  const changes = (item?.metadata?.settingsChanges ?? []).filter(
    (change) =>
      change.path !== "scoringPreset" && change.label !== "Scoring preset",
  );
  const hasLegacySummaryOnly = changes.some(
    (change) =>
      change.after === "Updated" ||
      /^\d+\s+rules$/i.test(change.before) ||
      change.label === "Custom scoring rules",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings updated</DialogTitle>
          <DialogDescription className="flex flex-col gap-1">
            <span>Commissioner changed {label}.</span>
            {item ? (
              <span>
                {formatActivityTime(item.createdAt)} UTC
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No field-level details were recorded for this change.
          </p>
        ) : hasLegacySummaryOnly ? (
          <p className="text-sm text-muted-foreground">
            This older entry only recorded that scoring rules changed, not the
            exact before/after. New settings saves list each changed rule in
            plain language.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {changes.map((change) => (
              <li
                key={`${change.path}-${change.label}`}
                className="flex flex-col gap-2 px-3 py-2.5"
              >
                <p className="text-sm font-medium">{change.label}</p>
                <div className="grid gap-1.5 text-xs">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground/70">
                      Before:{" "}
                    </span>
                    <span className="line-through">{change.before}</span>
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground/70">
                      After:{" "}
                    </span>
                    <span className="text-foreground">{change.after}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
