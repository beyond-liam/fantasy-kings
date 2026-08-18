import type { SosMatchupBucketId } from "@/lib/players/sos-thresholds";

export type PositionalSosMatchup = {
  positionId: string;
  rank: number;
  ptsAllowed: number;
  difficulty: SosMatchupBucketId;
  /** NFL teams in the ranking (usually 32). */
  teamCount: number;
};

/** positionId → opposing NFL team → rank / allowed / bucket. */
export type PositionalSosTable = Map<
  string,
  Map<string, PositionalSosMatchup>
>;

const MATCHUP_TONE: Record<SosMatchupBucketId, string> = {
  hard: "looks like one to avoid",
  easy: "looks friendly",
  mid: "looks about average",
};

export const SOS_NFL_TEAM_COUNT = 32;

export function lookupPositionalSos(
  table: PositionalSosTable | null | undefined,
  positionId: string | null | undefined,
  opponentAbbrev: string | null | undefined,
): PositionalSosMatchup | null {
  if (!table || !positionId || !opponentAbbrev) return null;
  return table.get(positionId)?.get(opponentAbbrev) ?? null;
}

export function formatOpposingPositionLabel(positionId: string): string {
  const id = positionId.trim();
  if (!id) return "this position";
  if (id.endsWith("s") || id.endsWith("S")) return id;
  return `${id}s`;
}

export function sosMatchupTone(difficulty: SosMatchupBucketId): string {
  return MATCHUP_TONE[difficulty];
}

export function formatPositionalSosTooltip(input: {
  opponentLabel: string;
  matchup: PositionalSosMatchup;
  positionLabel?: string;
}): {
  headline: string;
  rankValue: string;
  ptsValue: string;
  footnote: string;
} {
  const positionLabel = input.positionLabel?.trim() || "this position";
  const teamCount = input.matchup.teamCount || SOS_NFL_TEAM_COUNT;
  const pts = Number.isFinite(input.matchup.ptsAllowed)
    ? input.matchup.ptsAllowed.toFixed(1)
    : "—";
  return {
    headline: `${input.opponentLabel} ${sosMatchupTone(input.matchup.difficulty)} for ${positionLabel}.`,
    rankValue: `#${input.matchup.rank} of ${teamCount}`,
    ptsValue: `${pts} / game`,
    footnote: `#1 gives up the most fantasy points to ${positionLabel}.`,
  };
}
