import type { CreateLeagueWizardValues } from "@/lib/leagues/wizard-schema";
import {
  buildStandardRosterSlots,
  getDefaultDraftStartAt,
  WIZARD_DEFAULTS,
} from "@/lib/leagues/defaults";
import { getRegularSeasonEndWeek } from "@/lib/leagues/season-calendar";

const STORAGE_KEY = "fk-create-league-wizard";

export function getInitialWizardValues(): CreateLeagueWizardValues {
  const regularSeasonEndWeek = getRegularSeasonEndWeek(
    WIZARD_DEFAULTS.championshipWeek,
    WIZARD_DEFAULTS.playoffTeamCount,
  );

  return {
    leagueName: WIZARD_DEFAULTS.leagueName,
    leagueType: WIZARD_DEFAULTS.leagueType,
    teamCount: WIZARD_DEFAULTS.teamCount,
    divisionCount: WIZARD_DEFAULTS.divisionCount,
    playoffTeamCount: WIZARD_DEFAULTS.playoffTeamCount,
    championshipWeek: WIZARD_DEFAULTS.championshipWeek,
    rosterMode: WIZARD_DEFAULTS.rosterMode,
    benchSlots: WIZARD_DEFAULTS.benchSlots,
    irEnabled: WIZARD_DEFAULTS.irEnabled,
    irSlots: WIZARD_DEFAULTS.irSlots,
    irEligibleStatuses: [...WIZARD_DEFAULTS.irEligibleStatuses],
    taxiEnabled: WIZARD_DEFAULTS.taxiEnabled,
    taxiSlots: WIZARD_DEFAULTS.taxiSlots,
    scoringPreset: WIZARD_DEFAULTS.scoringPreset,
    customRosterSlots: buildStandardRosterSlots(
      WIZARD_DEFAULTS.benchSlots,
      0,
      0,
    ),
    waiversEnabled: WIZARD_DEFAULTS.waiversEnabled,
    waiverType: WIZARD_DEFAULTS.waiverType,
    faabBudget: WIZARD_DEFAULTS.faabBudget,
    tradesEnabled: WIZARD_DEFAULTS.tradesEnabled,
    tradeProcessing: WIZARD_DEFAULTS.tradeProcessing,
    tradeDeadlineWeek: regularSeasonEndWeek,
    draftType: WIZARD_DEFAULTS.draftType,
    draftStartAt: getDefaultDraftStartAt().toISOString(),
    pickTimeLimit: WIZARD_DEFAULTS.pickTimeLimit,
    pickTimeUnit: WIZARD_DEFAULTS.pickTimeUnit,
  };
}

export function loadWizardValues(): CreateLeagueWizardValues {
  if (typeof window === "undefined") {
    return getInitialWizardValues();
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getInitialWizardValues();
    }
    return { ...getInitialWizardValues(), ...JSON.parse(raw) };
  } catch {
    return getInitialWizardValues();
  }
}

export function saveWizardValues(values: CreateLeagueWizardValues) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

export function clearWizardValues() {
  sessionStorage.removeItem(STORAGE_KEY);
}
