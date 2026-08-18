import { dynastyPickLabel } from "@/lib/leagues/draft-pick-label";

export type TradePickAssetRow = {
  id: string;
  ownerTeamId: string;
  leagueId: string;
};

export function uniqueTradeIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

/**
 * Ownership + uniqueness for pick legs. Roster caps stay in validateTradeProposal.
 */
export function validatePickOwnership(input: {
  proposingTeamId: string;
  receivingTeamId: string;
  proposingPickIds: string[];
  receivingPickIds: string[];
  assets: TradePickAssetRow[];
  leagueId: string;
  isDynasty: boolean;
}): string | null {
  const proposingPickIds = uniqueTradeIds(input.proposingPickIds);
  const receivingPickIds = uniqueTradeIds(input.receivingPickIds);
  if (proposingPickIds.length === 0 && receivingPickIds.length === 0) {
    return null;
  }

  if (!input.isDynasty) {
    return "Draft picks can only be traded in dynasty leagues.";
  }

  const overlapping = proposingPickIds.filter((id) =>
    receivingPickIds.includes(id),
  );
  if (overlapping.length > 0) {
    return "The same pick cannot be offered by both teams.";
  }

  const byId = new Map(input.assets.map((asset) => [asset.id, asset]));
  const checkSide = (ids: string[], teamId: string, label: string) => {
    for (const id of ids) {
      const asset = byId.get(id);
      if (!asset || asset.leagueId !== input.leagueId) {
        return `${label}: a selected pick is not available.`;
      }
      if (asset.ownerTeamId !== teamId) {
        return `${label}: a selected pick is no longer owned by that team.`;
      }
    }
    return null;
  };

  return (
    checkSide(proposingPickIds, input.proposingTeamId, "Your team") ??
    checkSide(receivingPickIds, input.receivingTeamId, "Their team")
  );
}

export function tradeSideHasOffer(input: {
  playerIds: string[];
  pickIds: string[];
}) {
  return input.playerIds.length > 0 || input.pickIds.length > 0;
}

export type TradePickLabelInput = {
  draftYear: number;
  round: number;
  slot: number | null;
  originalTeamName: string;
  originalTeamId: string;
  ownerTeamId: string;
  originalTeamDraftSlot: number | null;
  currentSeasonYear: number;
};

export function tradePickDisplayLabel(input: TradePickLabelInput) {
  return dynastyPickLabel({
    draftYear: input.draftYear,
    round: input.round,
    slot: input.slot,
    originalTeamName: input.originalTeamName,
    isOriginalOwner: input.originalTeamId === input.ownerTeamId,
    currentSeasonYear: input.currentSeasonYear,
    originalTeamDraftSlot: input.originalTeamDraftSlot,
  });
}
