import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { leagueActivity } from "@/db/schema";
import { db } from "@/lib/db";
import type { TransactionRulesSettings } from "@/db/schema/league-seasons";
import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";

const COUNTED_TYPES = [
  "trade_completed",
  "player_added",
  "waiver_awarded",
] as const;

/**
 * Count in-season transactions for a team since `since`
 * (trades completed, FA adds, waiver awards).
 */
export async function countTeamTransactions(input: {
  leagueSeasonId: string;
  teamId: string;
  since: Date;
}): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(leagueActivity)
    .where(
      and(
        eq(leagueActivity.leagueSeasonId, input.leagueSeasonId),
        eq(leagueActivity.teamId, input.teamId),
        inArray(leagueActivity.type, [...COUNTED_TYPES]),
        gte(leagueActivity.createdAt, input.since),
      ),
    );
  return row?.value ?? 0;
}

function startOfUtcWeek(now: Date): Date {
  const day = now.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + mondayOffset,
      0,
      0,
      0,
      0,
    ),
  );
}

function startOfSeasonYear(seasonYear: number): Date {
  return new Date(Date.UTC(seasonYear, 0, 1, 0, 0, 0, 0));
}

export async function assertTransactionLimitsAllow(input: {
  leagueSeasonId: string;
  teamId: string;
  seasonYear: number;
  rules: TransactionRulesSettings | null | undefined;
  now?: Date;
}): Promise<string | null> {
  const rules = resolveTransactionRules(input.rules);
  if (rules.transactionLimits === "unlimited") {
    return null;
  }

  const now = input.now ?? new Date();
  const checkWeekly =
    rules.transactionLimits === "weekly" ||
    rules.transactionLimits === "both";
  const checkSeason =
    rules.transactionLimits === "season" ||
    rules.transactionLimits === "both";

  if (checkWeekly) {
    const max = rules.transactionWeeklyMax;
    if (max != null && max >= 0) {
      const used = await countTeamTransactions({
        leagueSeasonId: input.leagueSeasonId,
        teamId: input.teamId,
        since: startOfUtcWeek(now),
      });
      if (used >= max) {
        return `Weekly transaction limit reached (${max}).`;
      }
    }
  }

  if (checkSeason) {
    const max = rules.transactionSeasonMax;
    if (max != null && max >= 0) {
      const used = await countTeamTransactions({
        leagueSeasonId: input.leagueSeasonId,
        teamId: input.teamId,
        since: startOfSeasonYear(input.seasonYear),
      });
      if (used >= max) {
        return `Season transaction limit reached (${max}).`;
      }
    }
  }

  return null;
}
