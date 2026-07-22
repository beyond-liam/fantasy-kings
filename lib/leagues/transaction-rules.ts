import { z } from "zod";

import type { TransactionRulesSettings } from "@/db/schema/league-seasons";

export type TradeProcessing = "commissioner" | "review_24h" | "instant";

export type TransactionRulesFormValues = {
  tradesEnabled: boolean;
  tradeProcessing: TradeProcessing;
  tradeDeadlineWeek: number | null;
  permitTradesAfterSeason: boolean;
  addDropDeadlineWeek: number | null;
  permitAddDropsAfterSeason: boolean;
  enforceRosterMinimums: boolean;
  preseasonFreeAgents: "always_on_waivers" | "unlocked";
  preventCutsAfterGameStart: boolean;
  allowVetoes: boolean;
  transactionLimits: "unlimited" | "weekly" | "season" | "both";
};

export const TRADE_PROCESSING_OPTIONS: Array<{
  value: TradeProcessing;
  label: string;
}> = [
  { value: "commissioner", label: "Commissioner approval" },
  { value: "review_24h", label: "24-hour review" },
  { value: "instant", label: "Instant processing" },
];

export const DEFAULT_TRANSACTION_RULES: TransactionRulesSettings = {
  permitTradesAfterSeason: false,
  addDropDeadlineWeek: null,
  permitAddDropsAfterSeason: false,
  enforceRosterMinimums: false,
  preseasonFreeAgents: "unlocked",
  preventCutsAfterGameStart: true,
  allowVetoes: true,
  transactionLimits: "unlimited",
};

export const transactionRulesFormSchema = z
  .object({
    tradesEnabled: z.boolean(),
    tradeProcessing: z.enum(["commissioner", "review_24h", "instant"]),
    tradeDeadlineWeek: z.number().int().min(1).max(18).nullable(),
    permitTradesAfterSeason: z.boolean(),
    addDropDeadlineWeek: z.number().int().min(1).max(18).nullable(),
    permitAddDropsAfterSeason: z.boolean(),
    enforceRosterMinimums: z.boolean(),
    preseasonFreeAgents: z.enum(["always_on_waivers", "unlocked"]),
    preventCutsAfterGameStart: z.boolean(),
    allowVetoes: z.boolean(),
    transactionLimits: z.enum(["unlimited", "weekly", "season", "both"]),
  })
  .refine(
    (data) =>
      !data.tradesEnabled ||
      data.tradeDeadlineWeek == null ||
      (data.tradeDeadlineWeek >= 1 && data.tradeDeadlineWeek <= 18),
    {
      message: "Invalid trade deadline week",
      path: ["tradeDeadlineWeek"],
    },
  );

export function resolveTransactionRules(
  stored?: TransactionRulesSettings | null,
): TransactionRulesSettings {
  if (!stored) {
    return { ...DEFAULT_TRANSACTION_RULES };
  }

  return {
    permitTradesAfterSeason:
      stored.permitTradesAfterSeason ??
      DEFAULT_TRANSACTION_RULES.permitTradesAfterSeason,
    addDropDeadlineWeek:
      stored.addDropDeadlineWeek === undefined
        ? DEFAULT_TRANSACTION_RULES.addDropDeadlineWeek
        : stored.addDropDeadlineWeek,
    permitAddDropsAfterSeason:
      stored.permitAddDropsAfterSeason ??
      DEFAULT_TRANSACTION_RULES.permitAddDropsAfterSeason,
    enforceRosterMinimums:
      stored.enforceRosterMinimums ??
      DEFAULT_TRANSACTION_RULES.enforceRosterMinimums,
    preseasonFreeAgents:
      stored.preseasonFreeAgents ??
      DEFAULT_TRANSACTION_RULES.preseasonFreeAgents,
    preventCutsAfterGameStart:
      stored.preventCutsAfterGameStart ??
      DEFAULT_TRANSACTION_RULES.preventCutsAfterGameStart,
    allowVetoes: stored.allowVetoes ?? DEFAULT_TRANSACTION_RULES.allowVetoes,
    transactionLimits:
      stored.transactionLimits ?? DEFAULT_TRANSACTION_RULES.transactionLimits,
  };
}

export function toTransactionRulesFormValues(input: {
  tradesEnabled: boolean;
  tradeProcessing: TradeProcessing;
  tradeDeadlineWeek: number | null;
  transactionRules?: TransactionRulesSettings | null;
}): TransactionRulesFormValues {
  const rules = resolveTransactionRules(input.transactionRules);

  return {
    tradesEnabled: input.tradesEnabled,
    tradeProcessing: input.tradeProcessing,
    tradeDeadlineWeek: input.tradeDeadlineWeek,
    permitTradesAfterSeason: rules.permitTradesAfterSeason,
    addDropDeadlineWeek: rules.addDropDeadlineWeek,
    permitAddDropsAfterSeason: rules.permitAddDropsAfterSeason,
    enforceRosterMinimums: rules.enforceRosterMinimums,
    preseasonFreeAgents: rules.preseasonFreeAgents,
    preventCutsAfterGameStart: rules.preventCutsAfterGameStart,
    allowVetoes: rules.allowVetoes,
    transactionLimits: rules.transactionLimits,
  };
}

export function toPersistedTransactionRules(
  values: TransactionRulesFormValues,
): TransactionRulesSettings {
  return {
    permitTradesAfterSeason: values.permitTradesAfterSeason,
    addDropDeadlineWeek: values.addDropDeadlineWeek,
    permitAddDropsAfterSeason: values.permitAddDropsAfterSeason,
    enforceRosterMinimums: values.enforceRosterMinimums,
    preseasonFreeAgents: values.preseasonFreeAgents,
    preventCutsAfterGameStart: values.preventCutsAfterGameStart,
    allowVetoes: values.allowVetoes,
    transactionLimits: values.transactionLimits,
  };
}

export function buildWeekDeadlineOptions(maxWeek: number) {
  return Array.from({ length: Math.max(0, maxWeek) }, (_, index) => {
    const week = index + 1;
    return {
      value: String(week),
      label: `After week ${week}`,
    };
  });
}
