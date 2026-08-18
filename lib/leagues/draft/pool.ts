import type { DynastySettings } from "@/db/schema/league-seasons";
import {
  isDynastyStartupSeason,
  resolveDynastySettings,
} from "@/lib/leagues/dynasty-settings";

/** Year-2+ dynasty drafts with pool = rookies. Startup always allows everyone. */
export function dynastyDraftPoolRestrictsToRookies(
  stored?: Partial<DynastySettings> | null,
): boolean {
  if (!stored) return false;
  const dynasty = resolveDynastySettings(stored);
  if (isDynastyStartupSeason(dynasty)) return false;
  return dynasty.draftPlayerPool === "rookies";
}

export function isEligibleForDraftPlayerPool(
  yearsExp: number | null | undefined,
  restrictToRookies: boolean,
): boolean {
  if (!restrictToRookies) return true;
  return yearsExp === 0;
}
