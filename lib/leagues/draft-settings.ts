import { z } from "zod";

import type { DraftSettings } from "@/db/schema/league-seasons";
import { applyLocalTime, formatLocalTime } from "@/lib/datetime/local-time";
import {
  pickTimeToSeconds,
  secondsToPickTime,
  WIZARD_DEFAULTS,
} from "@/lib/leagues/defaults";

/** Default daily pause window (UTC) when the option is enabled. */
export const DEFAULT_PAUSE_WINDOW_START = "22:00";
export const DEFAULT_PAUSE_WINDOW_END = "08:00";

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const utcTimeOfDaySchema = z
  .string()
  .regex(HH_MM_REGEX, "Use HH:mm (UTC).");

export type DraftConfigFormValues = {
  draftType: "live" | "email";
  draftStartAt: string;
  draftStyle: "snake" | "linear";
  pickTimeLimitEnabled: boolean;
  pickTimeLimit: number;
  pickTimeUnit: "minutes" | "hours";
  autoPickEnabled: boolean;
  pauseWindowEnabled: boolean;
  pauseWindowStart: string;
  pauseWindowEnd: string;
};

/** Normalize stored/form draft type; defaults to live. */
export function resolveDraftType(
  draftType: "live" | "email" | null | undefined,
): "live" | "email" {
  return draftType === "email" ? "email" : "live";
}

/** @deprecated Use resolveDraftType — kept as alias during migration. */
export function coerceSupportedDraftType(
  draftType: "live" | "email" | null | undefined,
): "live" | "email" {
  return resolveDraftType(draftType);
}

export const DEFAULT_DRAFT_SETTINGS: DraftSettings = {
  style: "snake",
  autoPickEnabled: false,
  pickTimeLimitEnabled: true,
  pauseWindowEnabled: false,
  pauseWindowStart: DEFAULT_PAUSE_WINDOW_START,
  pauseWindowEnd: DEFAULT_PAUSE_WINDOW_END,
};

function pauseWindowAllowed(input: {
  draftType: "live" | "email";
  pickTimeLimitEnabled: boolean;
}): boolean {
  return input.draftType === "email" && input.pickTimeLimitEnabled;
}

export const draftConfigFormSchema = z
  .object({
    draftType: z.enum(["live", "email"]),
    draftStartAt: z.string().datetime(),
    draftStyle: z.enum(["snake", "linear"]),
    pickTimeLimitEnabled: z.boolean(),
    pickTimeLimit: z.number().int().min(1).max(48),
    pickTimeUnit: z.enum(["minutes", "hours"]),
    autoPickEnabled: z.boolean(),
    pauseWindowEnabled: z.boolean(),
    pauseWindowStart: utcTimeOfDaySchema,
    pauseWindowEnd: utcTimeOfDaySchema,
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.draftStartAt);
    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "Choose a valid draft start time.",
        path: ["draftStartAt"],
      });
    }

    if (
      pauseWindowAllowed(data) &&
      data.pauseWindowEnabled &&
      data.pauseWindowStart === data.pauseWindowEnd
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Pause window start and end must differ.",
        path: ["pauseWindowEnd"],
      });
    }
  });

export function resolveDraftSettings(
  stored?: DraftSettings | null,
): DraftSettings {
  return {
    style: stored?.style ?? DEFAULT_DRAFT_SETTINGS.style,
    autoPickEnabled:
      stored?.autoPickEnabled ?? DEFAULT_DRAFT_SETTINGS.autoPickEnabled,
    pickTimeLimitEnabled:
      stored?.pickTimeLimitEnabled ??
      DEFAULT_DRAFT_SETTINGS.pickTimeLimitEnabled,
    pauseWindowEnabled: Boolean(stored?.pauseWindowEnabled),
    pauseWindowStart:
      stored?.pauseWindowStart && HH_MM_REGEX.test(stored.pauseWindowStart)
        ? stored.pauseWindowStart
        : DEFAULT_PAUSE_WINDOW_START,
    pauseWindowEnd:
      stored?.pauseWindowEnd && HH_MM_REGEX.test(stored.pauseWindowEnd)
        ? stored.pauseWindowEnd
        : DEFAULT_PAUSE_WINDOW_END,
  };
}

export function toDraftConfigFormValues(input: {
  draftType: "live" | "email";
  draftStartAt: Date;
  pickTimeLimitSeconds: number;
  draft?: DraftSettings | null;
}): DraftConfigFormValues {
  const draft = resolveDraftSettings(input.draft);
  const pickTime = secondsToPickTime(
    input.pickTimeLimitSeconds > 0
      ? input.pickTimeLimitSeconds
      : pickTimeToSeconds(
          WIZARD_DEFAULTS.pickTimeLimit,
          WIZARD_DEFAULTS.pickTimeUnit,
        ),
  );
  const pickTimeLimitEnabled =
    input.draftType === "live" ? true : Boolean(draft.pickTimeLimitEnabled);
  const pauseAllowed = pauseWindowAllowed({
    draftType: input.draftType,
    pickTimeLimitEnabled,
  });

  return {
    draftType: input.draftType,
    draftStartAt: input.draftStartAt.toISOString(),
    draftStyle: draft.style,
    pickTimeLimitEnabled,
    pickTimeLimit: pickTime.value || WIZARD_DEFAULTS.pickTimeLimit,
    pickTimeUnit: pickTime.unit,
    autoPickEnabled: draft.autoPickEnabled,
    pauseWindowEnabled: pauseAllowed ? Boolean(draft.pauseWindowEnabled) : false,
    pauseWindowStart: draft.pauseWindowStart ?? DEFAULT_PAUSE_WINDOW_START,
    pauseWindowEnd: draft.pauseWindowEnd ?? DEFAULT_PAUSE_WINDOW_END,
  };
}

export function toPersistedDraftSettings(
  values: DraftConfigFormValues,
): DraftSettings {
  const pickTimeLimitEnabled =
    values.draftType === "live" ? true : values.pickTimeLimitEnabled;
  const pauseAllowed = pauseWindowAllowed({
    draftType: values.draftType,
    pickTimeLimitEnabled,
  });
  const pauseWindowEnabled = pauseAllowed && values.pauseWindowEnabled;

  return {
    style: values.draftStyle,
    // Auto-pick only applies when there is a pick clock.
    autoPickEnabled: pickTimeLimitEnabled ? values.autoPickEnabled : false,
    pickTimeLimitEnabled,
    pauseWindowEnabled,
    pauseWindowStart: pauseWindowEnabled
      ? values.pauseWindowStart
      : DEFAULT_PAUSE_WINDOW_START,
    pauseWindowEnd: pauseWindowEnabled
      ? values.pauseWindowEnd
      : DEFAULT_PAUSE_WINDOW_END,
  };
}

/**
 * Align form state with what `updateDraftConfig` persists so dirty checks
 * clear immediately after save (without waiting on `router.refresh()` props).
 */
export function normalizeDraftConfigFormValues(
  values: DraftConfigFormValues,
): DraftConfigFormValues {
  const persisted = toPersistedDraftSettings(values);
  const start = new Date(values.draftStartAt);
  const normalizedStart = Number.isNaN(start.getTime())
    ? values.draftStartAt
    : applyLocalTime(start, formatLocalTime(start)).toISOString();

  return {
    draftType: resolveDraftType(values.draftType),
    draftStartAt: normalizedStart,
    draftStyle: persisted.style,
    pickTimeLimitEnabled: Boolean(persisted.pickTimeLimitEnabled),
    pickTimeLimit: values.pickTimeLimit,
    pickTimeUnit: values.pickTimeUnit,
    autoPickEnabled: persisted.autoPickEnabled,
    pauseWindowEnabled: Boolean(persisted.pauseWindowEnabled),
    pauseWindowStart:
      persisted.pauseWindowStart ?? DEFAULT_PAUSE_WINDOW_START,
    pauseWindowEnd: persisted.pauseWindowEnd ?? DEFAULT_PAUSE_WINDOW_END,
  };
}

/** Seconds stored on the season; 0 means unlimited (slow draft only). */
export function draftConfigPickTimeSeconds(values: DraftConfigFormValues) {
  if (values.draftType === "email" && !values.pickTimeLimitEnabled) {
    return 0;
  }
  return pickTimeToSeconds(values.pickTimeLimit, values.pickTimeUnit);
}
