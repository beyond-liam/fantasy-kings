import { z } from "zod";

import type {
  DynastyDraftPlayerPool,
  DynastySettings,
} from "@/db/schema/league-seasons";
import { formatUkDateTime, ukTimezoneAbbrev } from "@/lib/datetime/uk-time";

export const DYNASTY_DRAFT_PLAYER_POOL_OPTIONS = [
  "rookies",
  "all",
] as const satisfies readonly DynastyDraftPlayerPool[];

/**
 * Product defaults when creating a dynasty league.
 * Keepers max starts empty — commissioner sets it in Dynasty Rules.
 */
export const DEFAULT_DYNASTY_SETTINGS: DynastySettings = {
  keepersMax: null,
  keepersMin: null,
  keeperDeadlineAt: null,
  irCountsTowardKeepers: false,
  taxiCountsTowardKeepers: false,
  futurePickTradeYears: 3,
  draftPlayerPool: "rookies",
  keepersLocked: false,
  isStartupSeason: true,
};

export type DynastyRosterKeeperCap = {
  /** Starters + bench (IR/Taxi excluded). */
  activeRosterSize: number;
  irSlots: number;
  taxiSlots: number;
};

/**
 * Absolute ceiling for `keepersMax` given roster size and IR/Taxi counting toggles.
 * Starters + bench always; IR/Taxi slots only when their toggles are on.
 */
export function maxCountingKeepersCap(
  roster: DynastyRosterKeeperCap,
  options: Pick<
    DynastySettings,
    "irCountsTowardKeepers" | "taxiCountsTowardKeepers"
  >,
): number {
  let max =
    Number.isFinite(roster.activeRosterSize) && roster.activeRosterSize > 0
      ? Math.trunc(roster.activeRosterSize)
      : 0;
  if (options.irCountsTowardKeepers) {
    max +=
      Number.isFinite(roster.irSlots) && roster.irSlots > 0
        ? Math.trunc(roster.irSlots)
        : 0;
  }
  if (options.taxiCountsTowardKeepers) {
    max +=
      Number.isFinite(roster.taxiSlots) && roster.taxiSlots > 0
        ? Math.trunc(roster.taxiSlots)
        : 0;
  }
  return Math.max(0, max);
}

/** Human-readable explainer for the keepers-max field description. */
export function keepersMaxDescription(
  roster: DynastyRosterKeeperCap,
  options: Pick<
    DynastySettings,
    "irCountsTowardKeepers" | "taxiCountsTowardKeepers"
  >,
): string {
  const max = maxCountingKeepersCap(roster, options);
  const parts = ["starters + bench"];
  if (options.irCountsTowardKeepers && roster.irSlots > 0) {
    parts.push("IR");
  }
  if (options.taxiCountsTowardKeepers && roster.taxiSlots > 0) {
    parts.push("Taxi");
  }
  return `Maximum counting keepers per team between seasons. Cap is ${max} with current rules (${parts.join(" + ")}).`;
}

/** Clamp keepers max/min to the roster-derived counting ceiling. */
export function clampDynastyKeepersToRosterCap<
  T extends Pick<
    DynastySettings,
    | "keepersMax"
    | "keepersMin"
    | "irCountsTowardKeepers"
    | "taxiCountsTowardKeepers"
  >,
>(settings: T, roster: DynastyRosterKeeperCap): T {
  const cap = maxCountingKeepersCap(roster, settings);
  const keepersMax =
    settings.keepersMax == null
      ? null
      : Math.min(Math.max(0, settings.keepersMax), cap);
  const keepersMin =
    settings.keepersMin == null
      ? null
      : Math.min(
          Math.max(0, settings.keepersMin),
          keepersMax ?? cap,
        );
  return { ...settings, keepersMax, keepersMin };
}

/** Seed dynasty settings for a new dynasty league (keepers max left unset). */
export function defaultDynastySettings(): DynastySettings {
  return { ...DEFAULT_DYNASTY_SETTINGS };
}

/**
 * Max configure-draft rounds for dynasty:
 * `rosterCap − keepersMax` (docs/DYNASTY.md §3.2).
 */
export function maxDynastyDraftRounds(
  rosterCap: number,
  keepersMax: number | null,
): number {
  const cap =
    Number.isFinite(rosterCap) && rosterCap > 0 ? Math.trunc(rosterCap) : 0;
  const keepers =
    keepersMax != null && Number.isFinite(keepersMax) && keepersMax > 0
      ? Math.trunc(keepersMax)
      : 0;
  return Math.max(0, cap - keepers);
}

/** Startup drafts fill the roster; later drafts cap at spare spots after keepers. */
export function maxConfigurableDynastyDraftRounds(input: {
  rosterCap: number;
  keepersMax: number | null;
  isStartup: boolean;
}): number {
  if (input.isStartup) {
    return Number.isFinite(input.rosterCap) && input.rosterCap > 0
      ? Math.trunc(input.rosterCap)
      : 0;
  }
  return maxDynastyDraftRounds(input.rosterCap, input.keepersMax);
}

export function isDynastyStartupSeason(
  settings: Pick<DynastySettings, "isStartupSeason">,
): boolean {
  return settings.isStartupSeason !== false;
}

export const dynastySettingsSchema = z
  .object({
    keepersMax: z.number().int().min(0).max(99).nullable(),
    keepersMin: z.number().int().min(0).max(99).nullable(),
    keeperDeadlineAt: z.string().min(1).nullable(),
    irCountsTowardKeepers: z.boolean(),
    taxiCountsTowardKeepers: z.boolean(),
    futurePickTradeYears: z.number().int().min(1).max(10),
    draftPlayerPool: z.enum(["rookies", "all"]),
  })
  .superRefine((data, ctx) => {
    if (
      data.keepersMin != null &&
      (data.keepersMax == null || data.keepersMin > data.keepersMax)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          data.keepersMax == null
            ? "Set keepers max before requiring a minimum"
            : "Keepers minimum cannot exceed maximum",
        path: ["keepersMin"],
      });
    }
    if (data.keeperDeadlineAt != null) {
      const parsed = Date.parse(data.keeperDeadlineAt);
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid keeper deadline",
          path: ["keeperDeadlineAt"],
        });
      }
    }
  });

export type DynastySettingsFormValues = z.infer<typeof dynastySettingsSchema>;

function clampKeepersMax(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_DYNASTY_SETTINGS.keepersMax;
  }
  const n = Math.trunc(value);
  if (n < 0) return 0;
  if (n > 99) return 99;
  return n;
}

function clampKeepersMin(
  value: unknown,
  keepersMax: number | null,
): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_DYNASTY_SETTINGS.keepersMin;
  }
  const n = Math.trunc(value);
  if (n < 0) return 0;
  if (keepersMax == null) return n;
  return Math.min(n, keepersMax);
}

function clampFuturePickTradeYears(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_DYNASTY_SETTINGS.futurePickTradeYears;
  }
  const n = Math.trunc(value);
  if (n < 1) return 1;
  if (n > 10) return 10;
  return n;
}

function resolveDraftPlayerPool(
  value: unknown,
): DynastyDraftPlayerPool {
  return value === "all" || value === "rookies"
    ? value
    : DEFAULT_DYNASTY_SETTINGS.draftPlayerPool;
}

function resolveKeeperDeadlineAt(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const trimmed = value.trim();
  return Number.isFinite(Date.parse(trimmed)) ? trimmed : null;
}

/** Merge stored dynasty JSON with defaults; safe for partial/legacy blobs. */
export function resolveDynastySettings(
  stored?: Partial<DynastySettings> | null,
): DynastySettings {
  if (!stored) {
    return { ...DEFAULT_DYNASTY_SETTINGS };
  }

  const keepersMax = clampKeepersMax(stored.keepersMax);
  return {
    keepersMax,
    keepersMin: clampKeepersMin(stored.keepersMin, keepersMax),
    keeperDeadlineAt: resolveKeeperDeadlineAt(stored.keeperDeadlineAt),
    irCountsTowardKeepers:
      stored.irCountsTowardKeepers ??
      DEFAULT_DYNASTY_SETTINGS.irCountsTowardKeepers,
    taxiCountsTowardKeepers:
      stored.taxiCountsTowardKeepers ??
      DEFAULT_DYNASTY_SETTINGS.taxiCountsTowardKeepers,
    futurePickTradeYears: clampFuturePickTradeYears(
      stored.futurePickTradeYears,
    ),
    draftPlayerPool: resolveDraftPlayerPool(stored.draftPlayerPool),
    keepersLocked: stored.keepersLocked === true,
    isStartupSeason: stored.isStartupSeason !== false,
  };
}

/** Persist form values into season settings.dynasty. */
export function toPersistedDynastySettings(
  values: DynastySettingsFormValues,
): DynastySettings {
  return resolveDynastySettings(values);
}

/** Keep operational lock state when saving Dynasty Rules. */
export function mergeDynastyFormWithStored(
  values: DynastySettingsFormValues,
  stored: DynastySettings,
): DynastySettings {
  return {
    ...toPersistedDynastySettings(values),
    keepersLocked: stored.keepersLocked,
    isStartupSeason: stored.isStartupSeason,
  };
}

export function areKeepersLocked(settings: DynastySettings): boolean {
  return settings.keepersLocked === true;
}

export function withKeepersLocked(
  settings: DynastySettings,
  locked: boolean,
): DynastySettings {
  if (settings.keepersLocked === locked) return settings;
  return { ...settings, keepersLocked: locked };
}

/** True when a deadline is set, keepers are unlocked, and the instant has passed. */
export function isKeeperDeadlineDue(
  settings: DynastySettings,
  now: Date = new Date(),
): boolean {
  if (settings.keepersLocked) return false;
  if (settings.keeperDeadlineAt == null) return false;
  const at = Date.parse(settings.keeperDeadlineAt);
  return Number.isFinite(at) && at <= now.getTime();
}

/** UK wall-clock label for a stored keeper deadline ISO instant. */
export function formatKeeperDeadlineLabel(iso: string): string | null {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  const date = new Date(at);
  return `${formatUkDateTime(date)} ${ukTimezoneAbbrev(date)}`;
}

/**
 * How many keepers count toward `keepersMax`.
 * Starter/bench always count; IR/Taxi only when toggles are on.
 */
export function countKeepersTowardMax(
  keepers: Array<{ slotPositionId: string | null | undefined }>,
  settings: Pick<
    DynastySettings,
    "irCountsTowardKeepers" | "taxiCountsTowardKeepers"
  >,
): number {
  let count = 0;
  for (const keeper of keepers) {
    const slot = keeper.slotPositionId;
    if (slot === "IR") {
      if (settings.irCountsTowardKeepers) count += 1;
      continue;
    }
    if (slot === "TAXI") {
      if (settings.taxiCountsTowardKeepers) count += 1;
      continue;
    }
    count += 1;
  }
  return count;
}

/** Whether marking this slot as keeper consumes a keepers-max slot. */
export function keeperSlotCountsTowardMax(
  slotPositionId: string | null | undefined,
  settings: Pick<
    DynastySettings,
    "irCountsTowardKeepers" | "taxiCountsTowardKeepers"
  >,
): boolean {
  if (slotPositionId === "IR") return settings.irCountsTowardKeepers;
  if (slotPositionId === "TAXI") return settings.taxiCountsTowardKeepers;
  return true;
}

export type ValidateKeeperSelectionResult =
  | { ok: true; counting: number }
  | { ok: false; error: string };

/** Enforce keepers max / optional min against counting keepers. */
export function validateKeeperSelection(
  keepers: Array<{ slotPositionId: string | null | undefined }>,
  settings: DynastySettings,
): ValidateKeeperSelectionResult {
  if (settings.keepersMax == null) {
    return {
      ok: false,
      error: "Set keepers max in Dynasty Rules before saving keepers.",
    };
  }
  const counting = countKeepersTowardMax(keepers, settings);
  if (counting > settings.keepersMax) {
    return {
      ok: false,
      error: `You can set at most ${settings.keepersMax} counting keepers.`,
    };
  }
  if (settings.keepersMin != null && counting < settings.keepersMin) {
    return {
      ok: false,
      error: `You must set at least ${settings.keepersMin} counting keepers.`,
    };
  }
  return { ok: true, counting };
}
