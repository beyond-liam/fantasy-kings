"use server";

import { eq } from "drizzle-orm";

import { leagueSeasons } from "@/db/schema";
import { db } from "@/lib/db";
import {
  getDefaultScoringRuleDefinitions,
  resolveScoringRuleDefinitions,
  scoringPositionsFromRosterSlots,
  type ScoringPreset,
  type ScoringRuleDefinition,
} from "@/lib/leagues/scoring";
import { scoringRulesPayloadSchema } from "@/lib/leagues/scoring/schema";
import {
  diffScoringRules,
  logSettingsUpdated,
} from "@/lib/leagues/settings-activity";

import {
  getCommissionerSeason,
  revalidateSettingsPaths,
  type ActionResult,
} from "./_shared";

const SCORING_PRESETS: ScoringPreset[] = [
  "standard",
  "half_ppr",
  "full_ppr",
];

export async function updateScoringPreset(
  slug: string,
  scoringPreset: ScoringPreset,
): Promise<ActionResult> {
  return updateScoringSettings(slug, { scoringPreset });
}

export async function updateScoringRules(
  slug: string,
  scoringRules: ScoringRuleDefinition[],
): Promise<ActionResult> {
  return updateScoringSettings(slug, { scoringRules });
}

/** Persist scoring preset and/or rules, logging a detailed rule-level activity diff. */
export async function updateScoringSettings(
  slug: string,
  input: {
    scoringPreset?: ScoringPreset;
    scoringRules?: ScoringRuleDefinition[];
  },
): Promise<ActionResult> {
  if (
    input.scoringPreset != null &&
    !SCORING_PRESETS.includes(input.scoringPreset)
  ) {
    return { success: false, error: "Invalid scoring preset." };
  }

  let nextRules: ScoringRuleDefinition[] | undefined;
  if (input.scoringRules != null) {
    const parsed = scoringRulesPayloadSchema.safeParse(input.scoringRules);
    if (!parsed.success) {
      return { success: false, error: "Invalid scoring rules payload." };
    }
    nextRules = parsed.data as ScoringRuleDefinition[];
  }

  if (input.scoringPreset == null && nextRules == null) {
    return { success: false, error: "Nothing to update." };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season, user } = result;
  const nextPreset = input.scoringPreset ?? (season.scoringPreset as ScoringPreset);
  const availablePositions = scoringPositionsFromRosterSlots(
    season.settings.rosterSlots,
  );
  const beforeRules = resolveScoringRuleDefinitions(
    season.scoringPreset as ScoringPreset,
    season.settings.scoringRules,
    availablePositions,
  );
  const afterRules =
    nextRules ??
    (input.scoringPreset != null
      ? getDefaultScoringRuleDefinitions(nextPreset, availablePositions)
      : beforeRules);

  await db
    .update(leagueSeasons)
    .set({
      scoringPreset: nextPreset,
      settings: {
        ...season.settings,
        scoringRules: afterRules,
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  const changes = diffScoringRules(beforeRules, afterRules);

  await logSettingsUpdated({
    leagueSeasonId: season.id,
    actorUserId: user.id,
    section: "scoring",
    label: "scoring rules",
    changes,
  });

  revalidateSettingsPaths(slug);

  return { success: true };
}
