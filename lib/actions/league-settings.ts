// Re-export all league settings actions from domain modules
export type { ActionResult } from "./league-settings/_shared";

export {
  updateScoringPreset,
  updateScoringRules,
  updateScoringSettings,
} from "./league-settings/scoring";

export { updateRosterRequirements } from "./league-settings/roster";

export { updateLineupLockMode } from "./league-settings/lineup-lock";

export {
  updateWaiverWireRules,
  updateWaiverOrder,
} from "./league-settings/waivers";

export { updateTiebreakerSettings } from "./league-settings/tiebreakers";

export { updateTransactionRules } from "./league-settings/transactions";

export { updateLeagueIdentity } from "./league-settings/identity";

export {
  updateDraftConfig,
  updateDraftOrder,
  randomizeDraftOrder,
} from "./league-settings/draft";

export {
  updateRegularSeasonSchedule,
  regenerateRegularSeasonSchedule,
  updatePlayoffSettings,
} from "./league-settings/schedule";

export {
  removeLeagueOwner,
  updateCoCommissioners,
} from "./league-settings/membership";

export {
  fillEmptySlotsWithBotTeams,
  openFreeAgency,
  updateLeagueSize,
  realignDivisions,
  type OpenFreeAgencyMode,
} from "./league-settings/league-size";
