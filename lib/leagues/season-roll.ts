import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";
import { getDraftRounds } from "@/lib/leagues/draft/board";
import {
  maxConfigurableDynastyDraftRounds,
  resolveDynastySettings,
} from "@/lib/leagues/dynasty-settings";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export type SeasonRollFinishTeam = {
  teamId: string;
  rank: number | null;
};

/** Upcoming draft year plus `futurePickTradeYears` later years. */
export function mintDraftPickYears(
  upcomingSeasonYear: number,
  futurePickTradeYears: number,
): number[] {
  const upcoming = Math.trunc(upcomingSeasonYear);
  const extra =
    Number.isFinite(futurePickTradeYears) && futurePickTradeYears >= 1
      ? Math.trunc(futurePickTradeYears)
      : 1;
  const years: number[] = [];
  for (let offset = 0; offset <= extra; offset += 1) {
    years.push(upcoming + offset);
  }
  return years;
}

export function mintDraftPickAssetSpecs(input: {
  teamIds: string[];
  years: number[];
  rounds: number;
}): Array<{
  draftYear: number;
  round: number;
  originalTeamId: string;
  ownerTeamId: string;
}> {
  const rounds =
    Number.isFinite(input.rounds) && input.rounds > 0
      ? Math.trunc(input.rounds)
      : 0;
  if (rounds === 0 || input.teamIds.length === 0 || input.years.length === 0) {
    return [];
  }

  const specs: Array<{
    draftYear: number;
    round: number;
    originalTeamId: string;
    ownerTeamId: string;
  }> = [];
  for (const teamId of input.teamIds) {
    for (const draftYear of input.years) {
      for (let round = 1; round <= rounds; round += 1) {
        specs.push({
          draftYear,
          round,
          originalTeamId: teamId,
          ownerTeamId: teamId,
        });
      }
    }
  }
  return specs;
}

/**
 * Reverse regular-season finish → draft slots.
 * Rank 1 (best) picks last. Unranked / unclaimed teams pick first.
 */
export function assignReverseFinishDraftSlots(
  teams: SeasonRollFinishTeam[],
): Array<{ teamId: string; draftSlot: number }> {
  const unranked = teams
    .filter((team) => team.rank == null)
    .toSorted((a, b) => a.teamId.localeCompare(b.teamId));
  const ranked = teams
    .filter((team) => team.rank != null)
    .toSorted((a, b) => (b.rank ?? 0) - (a.rank ?? 0));

  return [...unranked, ...ranked].map((team, index) => ({
    teamId: team.teamId,
    draftSlot: index + 1,
  }));
}

export function canStartNewDynastySeason(input: {
  leagueType: string;
  seasonStatus: string;
  nextSeasonExists: boolean;
  playoffsEnabled: boolean;
  championTeamId: string | null;
  regularSeasonFinished: boolean;
}): boolean {
  if (input.leagueType !== "dynasty") return false;
  if (input.seasonStatus !== "active") return false;
  if (input.nextSeasonExists) return false;
  if (input.playoffsEnabled) {
    return Boolean(input.championTeamId);
  }
  return input.regularSeasonFinished;
}

export function nextSeasonDraftStartAt(previous: Date, now: Date): Date {
  const next = new Date(previous.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + 1);
  if (next.getTime() > now.getTime()) {
    return next;
  }
  return new Date(now.getTime() + TWO_WEEKS_MS);
}

/** Overlay year-2+ dynasty flags and spare-round draft cap on copied settings. */
export function settingsForRolledDynastySeason(
  settings: LeagueSeasonSettings,
  benchSlots: number,
): LeagueSeasonSettings {
  const dynasty = resolveDynastySettings(settings.dynasty);
  const rosterCap = getDraftRounds(settings.rosterSlots, benchSlots);
  const rounds = maxConfigurableDynastyDraftRounds({
    rosterCap,
    keepersMax: dynasty.keepersMax,
    isStartup: false,
  });
  const draft = resolveDraftSettings(settings.draft);

  return {
    ...settings,
    dynasty: {
      ...dynasty,
      isStartupSeason: false,
      keepersLocked: false,
    },
    draft: {
      ...draft,
      rounds,
    },
  };
}

export function denialForSeasonRoll(input: {
  leagueType: string;
  seasonStatus: string;
  nextSeasonExists: boolean;
  playoffsEnabled: boolean;
  championTeamId: string | null;
  regularSeasonFinished: boolean;
}): string | null {
  if (input.leagueType !== "dynasty") {
    return "Starting a new season is only available in dynasty leagues.";
  }
  if (input.nextSeasonExists) {
    return "The next season has already been started.";
  }
  if (input.seasonStatus !== "active") {
    return "Finish the current season before starting the next one.";
  }
  if (input.playoffsEnabled && !input.championTeamId) {
    return "A champion must be crowned before starting the next season.";
  }
  if (!input.playoffsEnabled && !input.regularSeasonFinished) {
    return "The regular season must finish before starting the next season.";
  }
  return null;
}
