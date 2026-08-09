"use server";

import { eq } from "drizzle-orm";

import { leagueSeasons } from "@/db/schema";
import { db } from "@/lib/db";
import {
  diffSettingsValues,
  logSettingsUpdated,
} from "@/lib/leagues/settings-activity";
import {
  resolveTransactionRules,
  toPersistedTransactionRules,
  transactionRulesFormSchema,
  type TransactionRulesFormValues,
} from "@/lib/leagues/transaction-rules";

import {
  getCommissionerSeason,
  revalidateSettingsPaths,
  type ActionResult,
} from "./_shared";

export async function updateTransactionRules(
  slug: string,
  values: TransactionRulesFormValues,
): Promise<ActionResult> {
  const parsed = transactionRulesFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid transaction settings.",
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season, user } = result;
  const next = parsed.data;

  const before = {
    tradesEnabled: season.tradesEnabled,
    tradeProcessing: season.tradeProcessing,
    tradeDeadlineWeek: season.tradeDeadlineWeek,
    ...resolveTransactionRules(season.settings.transactionRules),
  };
  const afterRules = toPersistedTransactionRules(next);
  const after = {
    tradesEnabled: next.tradesEnabled,
    tradeProcessing: next.tradeProcessing,
    tradeDeadlineWeek: next.tradesEnabled ? next.tradeDeadlineWeek : null,
    ...afterRules,
  };

  await db
    .update(leagueSeasons)
    .set({
      tradesEnabled: next.tradesEnabled,
      tradeProcessing: next.tradeProcessing,
      tradeDeadlineWeek: next.tradesEnabled ? next.tradeDeadlineWeek : null,
      settings: {
        ...season.settings,
        transactionRules: afterRules,
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  await logSettingsUpdated({
    leagueSeasonId: season.id,
    actorUserId: user.id,
    section: "transactions",
    label: "transactions",
    changes: diffSettingsValues(before, after, [
      { path: "tradesEnabled", label: "Trades enabled" },
      { path: "tradeProcessing", label: "Trade processing" },
      { path: "tradeDeadlineWeek", label: "Trade deadline week" },
      { path: "allowVetoes", label: "Allow vetoes" },
      { path: "transactionLimits", label: "Transaction limits" },
      { path: "transactionWeeklyMax", label: "Weekly transaction max" },
      { path: "transactionSeasonMax", label: "Season transaction max" },
      { path: "addDropDeadlineWeek", label: "Add/drop deadline week" },
      { path: "enforceRosterMinimums", label: "Enforce roster minimums" },
      { path: "preventCutsAfterGameStart", label: "Prevent cuts after game start" },
    ]),
  });

  revalidateSettingsPaths(slug);

  return { success: true };
}
