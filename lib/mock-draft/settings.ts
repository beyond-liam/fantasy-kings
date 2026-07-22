import { z } from "zod";

import {
  buildPersistedRosterSlots,
  getDefaultCustomRosterSlots,
  rosterRequirementsSchema,
  type RosterRequirementsValues,
} from "@/lib/leagues/roster";
import { getMaxRosterSize } from "@/lib/leagues/roster-capacity";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";
import type { DraftStyle } from "@/db/schema/league-seasons";

export const MOCK_DRAFT_STORAGE_KEY = "fk:mock-draft:v1";

export type MockDraftScoring = ScoringPreset;
export type MockDraftStyle = DraftStyle;

export type MockDraftConfig = {
  scoring: MockDraftScoring;
  style: MockDraftStyle;
  teamCount: number;
  userSlot: number;
  pickClockSeconds: number;
  roster: RosterRequirementsValues;
};

const mockDraftConfigSchema = z
  .object({
    scoring: z.enum(["standard", "half_ppr", "full_ppr"]),
    style: z.enum(["snake", "linear"]),
    teamCount: z.number().int().min(4).max(16),
    userSlot: z.number().int().min(1).max(16),
    pickClockSeconds: z.number().int().min(15).max(300),
    roster: rosterRequirementsSchema,
  })
  .refine((data) => data.userSlot <= data.teamCount, {
    message: "Draft position must be within the number of teams",
    path: ["userSlot"],
  });

export function getDefaultMockDraftConfig(): MockDraftConfig {
  return {
    scoring: "full_ppr",
    style: "snake",
    teamCount: 12,
    userSlot: 1,
    pickClockSeconds: 60,
    roster: {
      rosterMode: "standard",
      benchSlots: 6,
      irEnabled: false,
      irSlots: 1,
      irEligibleStatuses: [],
      taxiEnabled: false,
      taxiSlots: 2,
      customRosterSlots: getDefaultCustomRosterSlots(),
    },
  };
}

export function parseMockDraftConfig(input: unknown): {
  success: true;
  data: MockDraftConfig;
} | {
  success: false;
  error: string;
} {
  const parsed = mockDraftConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid mock draft settings.",
    };
  }
  return { success: true, data: parsed.data };
}

export function getMockDraftRounds(config: MockDraftConfig) {
  const slots = buildPersistedRosterSlots(config.roster);
  return getMaxRosterSize(slots, config.roster.benchSlots);
}

export function scoringLabel(scoring: MockDraftScoring) {
  switch (scoring) {
    case "standard":
      return "Standard";
    case "half_ppr":
      return "Half PPR";
    case "full_ppr":
      return "PPR";
  }
}

export function writeMockDraftConfig(config: MockDraftConfig) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(MOCK_DRAFT_STORAGE_KEY, JSON.stringify(config));
}

export function readMockDraftConfig(): MockDraftConfig | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(MOCK_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = parseMockDraftConfig(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
