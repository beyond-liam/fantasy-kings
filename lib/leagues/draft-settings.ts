import { z } from "zod";

import type { DraftSettings } from "@/db/schema/league-seasons";
import {
  pickTimeToSeconds,
  secondsToPickTime,
  WIZARD_DEFAULTS,
} from "@/lib/leagues/defaults";

export type DraftConfigFormValues = {
  draftType: "live" | "email";
  draftStartAt: string;
  draftStyle: "snake" | "linear";
  pickTimeLimitEnabled: boolean;
  pickTimeLimit: number;
  pickTimeUnit: "minutes" | "hours";
  autoPickEnabled: boolean;
};

export const DEFAULT_DRAFT_SETTINGS: DraftSettings = {
  style: "snake",
  autoPickEnabled: false,
  pickTimeLimitEnabled: true,
};

export const draftConfigFormSchema = z
  .object({
    draftType: z.enum(["live", "email"]),
    draftStartAt: z.string().datetime(),
    draftStyle: z.enum(["snake", "linear"]),
    pickTimeLimitEnabled: z.boolean(),
    pickTimeLimit: z.number().int().min(1).max(48),
    pickTimeUnit: z.enum(["minutes", "hours"]),
    autoPickEnabled: z.boolean(),
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

  return {
    draftType: input.draftType,
    draftStartAt: input.draftStartAt.toISOString(),
    draftStyle: draft.style,
    // Live drafts always run with a clock; slow drafts can opt out.
    pickTimeLimitEnabled:
      input.draftType === "live" ? true : Boolean(draft.pickTimeLimitEnabled),
    pickTimeLimit: pickTime.value || WIZARD_DEFAULTS.pickTimeLimit,
    pickTimeUnit: pickTime.unit,
    autoPickEnabled: draft.autoPickEnabled,
  };
}

export function toPersistedDraftSettings(
  values: DraftConfigFormValues,
): DraftSettings {
  const pickTimeLimitEnabled =
    values.draftType === "live" ? true : values.pickTimeLimitEnabled;

  return {
    style: values.draftStyle,
    // Auto-pick only applies when there is a pick clock.
    autoPickEnabled: pickTimeLimitEnabled ? values.autoPickEnabled : false,
    pickTimeLimitEnabled,
  };
}

/** Seconds stored on the season; 0 means unlimited (slow draft only). */
export function draftConfigPickTimeSeconds(values: DraftConfigFormValues) {
  if (values.draftType === "email" && !values.pickTimeLimitEnabled) {
    return 0;
  }
  return pickTimeToSeconds(values.pickTimeLimit, values.pickTimeUnit);
}
