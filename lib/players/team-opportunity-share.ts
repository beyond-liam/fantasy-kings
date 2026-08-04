import type { OverviewShareKind } from "@/lib/players/overview-metrics";

export type OpportunityShareSeed = {
  kind: OverviewShareKind;
  label: string;
  playerPct: number;
  playerTotal: number;
  teamTotal: number;
};

type ShareConfig = {
  kind: Exclude<OverviewShareKind, "fg" | "kick">;
  label: string;
  key: string;
};

function shareConfigForPosition(positionId: string): ShareConfig | null {
  switch (positionId) {
    case "QB":
      return {
        kind: "pass",
        label: "Team pass attempts",
        key: "pass_att",
      };
    case "RB":
      return {
        kind: "carry",
        label: "Team rush attempts",
        key: "rush_att",
      };
    case "WR":
    case "TE":
      return {
        kind: "target",
        label: "Team targets",
        key: "rec_tgt",
      };
    default:
      return null;
  }
}

function numStat(
  bag: Record<string, number | null> | null | undefined,
  key: string,
): number {
  const value = bag?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Build opportunity share from a player's bag vs summed team bags. */
export function buildTeamOpportunityShare(input: {
  positionId: string;
  playerStats: Record<string, number | null> | null | undefined;
  teamStatsBags: Array<Record<string, number | null> | null | undefined>;
}): OpportunityShareSeed | null {
  const config = shareConfigForPosition(input.positionId);
  if (!config || !input.playerStats) return null;

  const playerTotal = numStat(input.playerStats, config.key);
  const teamTotal = input.teamStatsBags.reduce(
    (sum, bag) => sum + numStat(bag, config.key),
    0,
  );
  if (teamTotal <= 0) return null;

  return {
    kind: config.kind,
    label: config.label,
    playerPct: (playerTotal / teamTotal) * 100,
    playerTotal: Math.round(playerTotal),
    teamTotal: Math.round(teamTotal),
  };
}
