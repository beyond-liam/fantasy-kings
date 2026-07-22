import { z } from "zod";

import {
  CHAMPIONSHIP_WEEKS,
  getRegularSeasonEndWeek,
  PLAYOFF_TEAM_COUNTS,
  TEAM_COUNT_MAX,
  TEAM_COUNT_MIN,
} from "@/lib/leagues/season-calendar";
import { slugifyLeagueName } from "@/lib/leagues/utils";

const rosterSlotSchema = z.object({
  positionId: z.string().min(1),
  slotCount: z.number().int().min(1).max(20),
  minSlots: z.number().int().min(0).max(20),
  maxSlots: z.number().int().min(0).max(20),
  isStarter: z.boolean(),
});

export const setupStepSchema = z
  .object({
    leagueName: z.string().trim().min(2, "League name is required").max(60),
    leagueType: z.enum(["redraft", "dynasty"]),
    teamCount: z.number().int().min(TEAM_COUNT_MIN).max(TEAM_COUNT_MAX),
    divisionCount: z.number().int().min(1).max(4),
    playoffTeamCount: z.union([
      z.literal(4),
      z.literal(6),
      z.literal(8),
    ]),
    championshipWeek: z.union([
      z.literal(13),
      z.literal(14),
      z.literal(15),
      z.literal(16),
      z.literal(17),
      z.literal(18),
    ]),
  })
  .refine((data) => data.teamCount % data.divisionCount === 0, {
    message: "Team count must be divisible by number of divisions",
    path: ["divisionCount"],
  })
  .refine(
    (data) => {
      const slug = slugifyLeagueName(data.leagueName);
      return slug.length >= 2 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
    },
    {
      message: "League name must include letters or numbers",
      path: ["leagueName"],
    },
  )
  .refine(
    (data) =>
      CHAMPIONSHIP_WEEKS.includes(data.championshipWeek) &&
      PLAYOFF_TEAM_COUNTS.includes(data.playoffTeamCount) &&
      getRegularSeasonEndWeek(data.championshipWeek, data.playoffTeamCount) >= 1,
    {
      message: "Invalid championship week for playoff format",
      path: ["championshipWeek"],
    },
  );

const irEligibleStatusSchema = z.enum([
  "Questionable",
  "IR",
  "PUP",
  "Out",
  "Suspended",
]);

export const rosterStepSchema = z
  .object({
    rosterMode: z.enum(["standard", "custom"]),
    benchSlots: z.number().int().min(0).max(15),
    irEnabled: z.boolean(),
    irSlots: z.number().int().min(0).max(5),
    irEligibleStatuses: z.array(irEligibleStatusSchema),
    taxiEnabled: z.boolean(),
    taxiSlots: z.number().int().min(0).max(5),
    scoringPreset: z.enum(["standard", "half_ppr", "full_ppr"]),
    customRosterSlots: z.array(rosterSlotSchema),
  })
  .refine((data) => !data.irEnabled || data.irSlots >= 1, {
    message: "Add at least one IR spot",
    path: ["irSlots"],
  })
  .refine(
    (data) => !data.irEnabled || data.irEligibleStatuses.length > 0,
    {
      message: "Select at least one IR-eligible designation",
      path: ["irEligibleStatuses"],
    },
  )
  .refine((data) => !data.taxiEnabled || data.taxiSlots >= 1, {
    message: "Add at least one taxi spot",
    path: ["taxiSlots"],
  })
  .refine(
    (data) => data.rosterMode === "standard" || data.customRosterSlots.length > 0,
    {
      message: "Add at least one roster position",
      path: ["customRosterSlots"],
    },
  );

export const transactionsStepSchema = z
  .object({
    waiversEnabled: z.boolean(),
    waiverType: z.enum(["priority", "faab"]),
    faabBudget: z.number().int().min(1).max(1000),
    tradesEnabled: z.boolean(),
    tradeProcessing: z.enum(["commissioner", "review_24h", "instant"]),
    tradeDeadlineWeek: z.number().int().min(1).max(18),
  })
  .refine((data) => !data.waiversEnabled || data.waiverType !== "faab" || data.faabBudget > 0, {
    message: "FAAB budget is required",
    path: ["faabBudget"],
  });

export const draftStepSchema = z.object({
  draftType: z.enum(["live", "email"]),
  draftStartAt: z.string().datetime(),
  pickTimeLimit: z.number().int().min(1).max(48),
  pickTimeUnit: z.enum(["minutes", "hours"]),
});

export const createLeagueWizardSchema = setupStepSchema
  .and(rosterStepSchema)
  .and(transactionsStepSchema)
  .and(draftStepSchema);

export type SetupStepValues = z.infer<typeof setupStepSchema>;
export type RosterStepValues = z.infer<typeof rosterStepSchema>;
export type TransactionsStepValues = z.infer<typeof transactionsStepSchema>;
export type DraftStepValues = z.infer<typeof draftStepSchema>;
export type CreateLeagueWizardValues = z.infer<typeof createLeagueWizardSchema>;

export const WIZARD_STEPS = [
  "setup",
  "roster",
  "transactions",
  "draft",
  "review",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export function isWizardStep(value: string): value is WizardStep {
  return WIZARD_STEPS.includes(value as WizardStep);
}
