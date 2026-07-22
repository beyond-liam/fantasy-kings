import type { WaiverWireSettings } from "@/db/schema/league-seasons";
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
  now?: Date;
}): AcquisitionKind {
  return getAcquisitionKind({
    waiversEnabled: input.waiversEnabled,
    waiverWire: input.waiverWire,
    rosterTransactionsEnabled: input.rosterTransactionsEnabled,
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
