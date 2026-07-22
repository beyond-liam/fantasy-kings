import { z } from "zod";

import type {
  WaiverProcessDay,
  WaiverWireSettings,
} from "@/db/schema/league-seasons";

export type WaiverWireFormValues = {
  waiversEnabled: boolean;
  waiverType: "priority" | "faab";
  faabBudget: number;
  allowZeroBids: boolean;
  waiverPool: WaiverWireSettings["waiverPool"];
  dropWaiverHours: WaiverWireSettings["dropWaiverHours"];
  churnPrevention: WaiverWireSettings["churnPrevention"];
  fcfsMode: WaiverWireSettings["fcfsMode"];
  processDays: WaiverProcessDay[];
  resetOrderWeekly: boolean;
};

export const WAIVER_PROCESS_DAY_OPTIONS: Array<{
  value: WaiverProcessDay;
  label: string;
}> = [
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
  { value: "sun", label: "Sunday" },
  { value: "mon", label: "Monday" },
];

export const DEFAULT_WAIVER_WIRE_SETTINGS: WaiverWireSettings = {
  allowZeroBids: true,
  waiverPool: "drops_and_free_agents",
  dropWaiverHours: 24,
  churnPrevention: "return_to_fa",
  fcfsMode: "after_process",
  /** Single weekly process day (default Wednesday). */
  processDays: ["wed"],
  resetOrderWeekly: true,
};

export const DEFAULT_WAIVER_WIRE_FORM: WaiverWireFormValues = {
  waiversEnabled: true,
  waiverType: "priority",
  faabBudget: 100,
  ...DEFAULT_WAIVER_WIRE_SETTINGS,
};

const processDaySchema = z.enum(["wed", "thu", "fri", "sat", "sun", "mon"]);

export const waiverWireFormSchema = z
  .object({
    waiversEnabled: z.boolean(),
    waiverType: z.enum(["priority", "faab"]),
    faabBudget: z.number().int().min(1).max(1000),
    allowZeroBids: z.boolean(),
    waiverPool: z.enum(["drops_only", "drops_and_free_agents"]),
    dropWaiverHours: z.union([z.literal(24), z.literal(48)]),
    churnPrevention: z.enum(["return_to_fa", "block_late_drops", "none"]),
    fcfsMode: z.enum(["after_process", "never"]),
    processDays: z.array(processDaySchema),
    resetOrderWeekly: z.boolean(),
  })
  .refine(
    (data) =>
      !data.waiversEnabled ||
      data.waiverType !== "faab" ||
      data.faabBudget >= 1,
    {
      message: "FAAB budget must be at least 1",
      path: ["faabBudget"],
    },
  )
  .refine(
    (data) => !data.waiversEnabled || data.processDays.length === 1,
    {
      message: "Select one day for waiver processing",
      path: ["processDays"],
    },
  );

export function resolveWaiverWireSettings(
  stored?: WaiverWireSettings | null,
): WaiverWireSettings {
  if (!stored) {
    return { ...DEFAULT_WAIVER_WIRE_SETTINGS };
  }

  return {
    allowZeroBids: stored.allowZeroBids ?? DEFAULT_WAIVER_WIRE_SETTINGS.allowZeroBids,
    waiverPool: stored.waiverPool ?? DEFAULT_WAIVER_WIRE_SETTINGS.waiverPool,
    dropWaiverHours:
      stored.dropWaiverHours ?? DEFAULT_WAIVER_WIRE_SETTINGS.dropWaiverHours,
    churnPrevention:
      stored.churnPrevention ?? DEFAULT_WAIVER_WIRE_SETTINGS.churnPrevention,
    fcfsMode: stored.fcfsMode ?? DEFAULT_WAIVER_WIRE_SETTINGS.fcfsMode,
    processDays:
      stored.processDays?.length === 1
        ? stored.processDays
        : stored.processDays?.length
          ? [stored.processDays[0]!]
          : DEFAULT_WAIVER_WIRE_SETTINGS.processDays,
    resetOrderWeekly:
      stored.resetOrderWeekly ?? DEFAULT_WAIVER_WIRE_SETTINGS.resetOrderWeekly,
  };
}

export function toWaiverWireFormValues(input: {
  waiversEnabled: boolean;
  waiverType: "priority" | "faab";
  faabBudget: number | null;
  waiverWire?: WaiverWireSettings | null;
}): WaiverWireFormValues {
  const wire = resolveWaiverWireSettings(input.waiverWire);

  return {
    waiversEnabled: input.waiversEnabled,
    waiverType: input.waiverType,
    faabBudget: input.faabBudget ?? DEFAULT_WAIVER_WIRE_FORM.faabBudget,
    ...wire,
  };
}

export function toPersistedWaiverWire(
  values: WaiverWireFormValues,
): WaiverWireSettings {
  return {
    allowZeroBids: values.allowZeroBids,
    waiverPool: values.waiverPool,
    dropWaiverHours: values.dropWaiverHours,
    churnPrevention: values.churnPrevention,
    fcfsMode: values.fcfsMode,
    processDays: values.processDays,
    resetOrderWeekly: values.resetOrderWeekly,
  };
}
