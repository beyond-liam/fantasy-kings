import type { ScheduleSettings, WaiverWireSettings } from "@/db/schema/league-seasons";
import { isFantasyLeaguePreseason } from "@/lib/leagues/season-calendar";
import {
  getAcquisitionKind,
  type AcquisitionKind,
} from "@/lib/leagues/waivers/acquisition";
import { hasNflTeamStarted } from "@/lib/leagues/waivers/game-lock";

export function resolvePlayerAcquisitionKind(input: {
  waiversEnabled: boolean;
  waiverWire: WaiverWireSettings;
  rosterTransactionsEnabled: boolean;
  fantasyTeamId: string | null | undefined;
  onWaivers: boolean;
  nflTeam?: string | null;
  startedNflTeams?: Set<string>;
  /** When set with seasonYear, derives fantasy-league preseason from the calendar. */
  seasonYear?: number;
  nfl?: { season: string; season_type: string; week: number } | null;
  schedule?: ScheduleSettings | null;
  /** Prefer deriving via seasonYear + nfl; kept for tests. */
  isFantasyPreseason?: boolean;
  now?: Date;
}): AcquisitionKind {
  const isFantasyPreseason =
    input.isFantasyPreseason ??
    (input.seasonYear != null && input.nfl
      ? isFantasyLeaguePreseason(
          input.seasonYear,
          input.nfl,
          input.schedule,
        )
      : false);

  return getAcquisitionKind({
    waiversEnabled: input.waiversEnabled,
    waiverWire: input.waiverWire,
    rosterTransactionsEnabled: input.rosterTransactionsEnabled,
    isFantasyPreseason,
    now: input.now,
    ownership: {
      fantasyTeamId: input.fantasyTeamId ?? null,
      onWaivers: input.onWaivers,
    },
    gameStartedThisWeek: hasNflTeamStarted(
      input.nflTeam,
      input.startedNflTeams ?? new Set(),
    ),
  });
}
