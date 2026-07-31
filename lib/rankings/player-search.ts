import type { RankedPlayerRow } from "@/lib/queries/players";

export const PLAYER_SEARCH_PAGE_SIZE = 40;

export type PlayerSearchRow = Pick<
  RankedPlayerRow,
  | "id"
  | "fullName"
  | "sleeperId"
  | "primaryPositionId"
  | "nflTeam"
  | "byeWeek"
  | "injuryStatus"
  | "fantasyPts"
  | "fantasyTeamId"
  | "fantasyTeamName"
  | "fantasyTeamSlug"
  | "isOwnedByCurrentUser"
  | "onWaivers"
  | "acquisitionKind"
  | "hasPendingClaim"
>;
