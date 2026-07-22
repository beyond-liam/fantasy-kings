import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import {
  countActivePositionPlayers,
  countActiveRosterPlayers,
  countsTowardRosterMax,
  getMaxRosterSize,
  getPositionRosterMax,
  validateActiveRosterCaps,
} from "@/lib/leagues/roster-capacity";

export type TradeRosterPlayer = {
  id: string;
  slotPositionId: string | null;
  primaryPositionId: string;
};

export type TradeValidationResult =
  | { ok: true; dropsRequired: { teamId: string; count: number }[] }
  | { ok: false; errors: string[] };

function slotMinForPosition(
  rosterSlots: RosterSlotConfig[] | null | undefined,
  positionId: string,
) {
  const slots = rosterSlots ?? [];
  let min = 0;
  for (const slot of slots) {
    if (slot.positionId === positionId) {
      min += slot.minSlots ?? 0;
    }
  }
  return min;
}

function validateRosterMinimums(
  players: TradeRosterPlayer[],
  rosterSlots: RosterSlotConfig[] | null | undefined,
  enforce: boolean,
) {
  if (!enforce) {
    return [] as string[];
  }

  const errors: string[] = [];
  const positionIds = new Set(players.map((player) => player.primaryPositionId));

  for (const positionId of positionIds) {
    const min = slotMinForPosition(rosterSlots, positionId);
    if (min <= 0) {
      continue;
    }
    const count = players.filter(
      (player) => player.primaryPositionId === positionId,
    ).length;
    if (count < min) {
      errors.push(
        `Roster would be below the minimum ${positionId} count (${min}).`,
      );
    }
  }

  return errors;
}

export function simulatePostTradeRoster(input: {
  roster: TradeRosterPlayer[];
  outgoingIds: Set<string>;
  incoming: TradeRosterPlayer[];
  dropIds: Set<string>;
}) {
  const remaining = input.roster.filter(
    (player) =>
      !input.outgoingIds.has(player.id) && !input.dropIds.has(player.id),
  );
  return [...remaining, ...input.incoming];
}

export function validateTeamPostTrade(input: {
  teamId: string;
  teamLabel: string;
  roster: TradeRosterPlayer[];
  offeringIds: string[];
  receiving: TradeRosterPlayer[];
  dropIds: string[];
  rosterSlots: RosterSlotConfig[] | null | undefined;
  benchSlots: number;
  enforceRosterMinimums: boolean;
}): { ok: true } | { ok: false; error: string } {
  const outgoing = new Set(input.offeringIds);
  const drops = new Set(input.dropIds);
  const next = simulatePostTradeRoster({
    roster: input.roster,
    outgoingIds: outgoing,
    incoming: input.receiving,
    dropIds: drops,
  });

  const caps = validateActiveRosterCaps(
    next,
    input.rosterSlots,
    input.benchSlots,
  );
  if (!caps.ok) {
    return {
      ok: false,
      error: `${input.teamLabel}: ${caps.error}`,
    };
  }

  const minErrors = validateRosterMinimums(
    next,
    input.rosterSlots,
    input.enforceRosterMinimums,
  );
  if (minErrors.length > 0) {
    return { ok: false, error: `${input.teamLabel}: ${minErrors[0]}` };
  }

  return { ok: true };
}

export function countDropsNeeded(input: {
  roster: TradeRosterPlayer[];
  offeringIds: string[];
  receiving: TradeRosterPlayer[];
  rosterSlots: RosterSlotConfig[] | null | undefined;
  benchSlots: number;
}) {
  return analyzeTradeDrops(input).rosterOverBy;
}

export type PositionOverage = {
  positionId: string;
  overBy: number;
  max: number;
};

export type TradeDropAnalysis = {
  rosterOverBy: number;
  positionOverages: PositionOverage[];
  /** Minimum drops required to clear roster + position caps. */
  dropsNeeded: number;
  reasons: Array<"roster" | "position">;
  /**
   * - `all`: roster overflow only — every candidate selectable
   * - `positions`: position overflow only — only over-max positions
   * - `mixed`: both — list everyone; disable positions that don't help maximums
   *   (unless constrained positions can't cover the roster need)
   */
  selectionMode: "none" | "all" | "positions" | "mixed";
  candidates: TradeRosterPlayer[];
  /** When set, only these primary positions are selectable. */
  selectablePositionIds: string[] | null;
};

function simulateTradeWithoutDrops(input: {
  roster: TradeRosterPlayer[];
  offeringIds: string[];
  receiving: TradeRosterPlayer[];
}) {
  const outgoing = new Set(input.offeringIds);
  const afterOutgoing = input.roster.filter(
    (player) => !outgoing.has(player.id),
  );
  return [...afterOutgoing, ...input.receiving];
}

function listPositionOverages(
  players: TradeRosterPlayer[],
  rosterSlots: RosterSlotConfig[] | null | undefined,
): PositionOverage[] {
  const positionIds = new Set(
    players
      .filter((player) =>
        countsTowardRosterMax(player.slotPositionId, player.primaryPositionId),
      )
      .map((player) => player.primaryPositionId),
  );

  const overages: PositionOverage[] = [];
  for (const positionId of positionIds) {
    const max = getPositionRosterMax(rosterSlots, positionId);
    if (max === Number.POSITIVE_INFINITY) {
      continue;
    }
    const count = countActivePositionPlayers(players, positionId);
    const overBy = count - max;
    if (overBy > 0) {
      overages.push({ positionId, overBy, max });
    }
  }

  return overages.toSorted((a, b) =>
    a.positionId.localeCompare(b.positionId),
  );
}

export function analyzeTradeDrops(input: {
  roster: TradeRosterPlayer[];
  offeringIds: string[];
  receiving: TradeRosterPlayer[];
  rosterSlots: RosterSlotConfig[] | null | undefined;
  benchSlots: number;
}): TradeDropAnalysis {
  const afterTrade = simulateTradeWithoutDrops(input);
  const maxRoster = getMaxRosterSize(input.rosterSlots, input.benchSlots);
  const active = countActiveRosterPlayers(afterTrade);
  const rosterOverBy = Math.max(0, active - maxRoster);
  const positionOverages = listPositionOverages(
    afterTrade,
    input.rosterSlots,
  );
  const positionDropsNeeded = positionOverages.reduce(
    (sum, overage) => sum + overage.overBy,
    0,
  );
  const dropsNeeded = Math.max(rosterOverBy, positionDropsNeeded);

  const reasons: Array<"roster" | "position"> = [];
  if (rosterOverBy > 0) {
    reasons.push("roster");
  }
  if (positionOverages.length > 0) {
    reasons.push("position");
  }

  const outgoing = new Set(input.offeringIds);
  const candidates = input.roster.filter((player) => !outgoing.has(player.id));

  if (dropsNeeded === 0) {
    return {
      rosterOverBy: 0,
      positionOverages: [],
      dropsNeeded: 0,
      reasons: [],
      selectionMode: "none",
      candidates: [],
      selectablePositionIds: null,
    };
  }

  const constrainedPositions = positionOverages.map(
    (overage) => overage.positionId,
  );

  if (rosterOverBy > 0 && positionOverages.length === 0) {
    return {
      rosterOverBy,
      positionOverages,
      dropsNeeded,
      reasons,
      selectionMode: "all",
      candidates,
      selectablePositionIds: null,
    };
  }

  if (rosterOverBy === 0 && positionOverages.length > 0) {
    return {
      rosterOverBy,
      positionOverages,
      dropsNeeded,
      reasons,
      selectionMode: "positions",
      candidates,
      selectablePositionIds: constrainedPositions,
    };
  }

  // Both: list everyone; disable positions that don't help maximums until
  // those position needs are met, then allow any remaining roster drops.
  return {
    rosterOverBy,
    positionOverages,
    dropsNeeded,
    reasons,
    selectionMode: "mixed",
    candidates,
    selectablePositionIds: constrainedPositions,
  };
}

export function isDropPlayerSelectable(
  analysis: TradeDropAnalysis,
  player: Pick<TradeRosterPlayer, "primaryPositionId">,
  selectedIds: string[] = [],
  roster: Array<Pick<TradeRosterPlayer, "id" | "primaryPositionId">> = [],
) {
  if (analysis.selectionMode === "none" || analysis.selectionMode === "all") {
    return true;
  }

  if (analysis.selectionMode === "positions") {
    return (
      analysis.selectablePositionIds?.includes(player.primaryPositionId) ??
      false
    );
  }

  // mixed: require over-max positions first, then open the rest for roster room
  const byId = new Map(roster.map((row) => [row.id, row]));
  const selectedPlayers = selectedIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });

  const positionsStillNeeded = analysis.positionOverages.flatMap((overage) => {
    const selectedFromPosition = selectedPlayers.filter(
      (row) => row.primaryPositionId === overage.positionId,
    ).length;
    return selectedFromPosition < overage.overBy ? [overage.positionId] : [];
  });

  if (positionsStillNeeded.length > 0) {
    return positionsStillNeeded.includes(player.primaryPositionId);
  }

  return true;
}

export function countFeasibleDropCandidates(analysis: TradeDropAnalysis) {
  if (
    analysis.selectionMode === "all" ||
    analysis.selectionMode === "mixed" ||
    analysis.selectionMode === "none"
  ) {
    return analysis.candidates.length;
  }

  return analysis.candidates.filter((player) =>
    isDropPlayerSelectable(analysis, player),
  ).length;
}

export function areTradeDropsSatisfied(
  analysis: TradeDropAnalysis,
  dropIds: string[],
  roster: TradeRosterPlayer[],
) {
  if (analysis.dropsNeeded === 0) {
    return true;
  }
  if (dropIds.length < analysis.dropsNeeded) {
    return false;
  }

  const byId = new Map(roster.map((player) => [player.id, player]));
  const dropped = dropIds
    .map((id) => byId.get(id))
    .filter((player): player is TradeRosterPlayer => Boolean(player));

  if (dropped.length < dropIds.length) {
    return false;
  }

  if (
    analysis.selectablePositionIds &&
    analysis.selectionMode === "positions" &&
    dropped.some(
      (player) =>
        !analysis.selectablePositionIds!.includes(player.primaryPositionId),
    )
  ) {
    return false;
  }

  for (const overage of analysis.positionOverages) {
    const fromPosition = dropped.filter(
      (player) => player.primaryPositionId === overage.positionId,
    ).length;
    if (fromPosition < overage.overBy) {
      return false;
    }
  }

  return true;
}

export function formatTradeDropAlert(analysis: TradeDropAnalysis): {
  title: string;
  description: string;
} {
  if (analysis.reasons.includes("roster") && analysis.reasons.includes("position")) {
    const positionNeed = analysis.positionOverages
      .map((overage) => {
        const label =
          overage.overBy === 1
            ? `1 ${overage.positionId}`
            : `${overage.overBy} ${overage.positionId}s`;
        return label;
      })
      .join(" and ");
    return {
      title: "Roster and position limits",
      description: `This trade exceeds your roster size and position maximums. Drop ${analysis.dropsNeeded} player${analysis.dropsNeeded === 1 ? "" : "s"}, including at least ${positionNeed}.`,
    };
  }

  if (analysis.reasons.includes("position")) {
    const overage = analysis.positionOverages[0];
    const title =
      analysis.positionOverages.length === 1
        ? `${overage.positionId} maximum reached`
        : "Position maximums reached";
    const details = analysis.positionOverages
      .map((item) => {
        const need =
          item.overBy === 1 ? `1 ${item.positionId}` : `${item.overBy} ${item.positionId}s`;
        return `${need} (max ${item.max})`;
      })
      .join(" and ");
    return {
      title,
      description: `This trade exceeds your position limit. Drop ${details}.`,
    };
  }

  return {
    title: "Roster is full",
    description: `This trade exceeds your roster size. Drop ${analysis.dropsNeeded} player${analysis.dropsNeeded === 1 ? "" : "s"} to make room.`,
  };
}

export function validateTradeProposal(input: {
  proposingTeamId: string;
  proposingTeamLabel: string;
  receivingTeamId: string;
  receivingTeamLabel: string;
  proposingRoster: TradeRosterPlayer[];
  receivingRoster: TradeRosterPlayer[];
  proposingOfferIds: string[];
  receivingOfferIds: string[];
  proposingDropIds: string[];
  receivingDropIds: string[];
  rosterSlots: RosterSlotConfig[] | null | undefined;
  benchSlots: number;
  enforceRosterMinimums: boolean;
}): TradeValidationResult {
  const errors: string[] = [];

  if (input.proposingOfferIds.length === 0 && input.receivingOfferIds.length === 0) {
    errors.push("Select at least one player to trade.");
  }

  if (input.proposingOfferIds.length === 0 || input.receivingOfferIds.length === 0) {
    errors.push("Each team must offer at least one player.");
  }

  const proposingReceiving = input.receivingRoster.filter((player) =>
    input.receivingOfferIds.includes(player.id),
  );
  const receivingReceiving = input.proposingRoster.filter((player) =>
    input.proposingOfferIds.includes(player.id),
  );

  const proposingDropAnalysis = analyzeTradeDrops({
    roster: input.proposingRoster,
    offeringIds: input.proposingOfferIds,
    receiving: proposingReceiving,
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
  });

  const proposingResult = validateTeamPostTrade({
    teamId: input.proposingTeamId,
    teamLabel: input.proposingTeamLabel,
    roster: input.proposingRoster,
    offeringIds: input.proposingOfferIds,
    receiving: proposingReceiving,
    dropIds: input.proposingDropIds,
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
    enforceRosterMinimums: input.enforceRosterMinimums,
  });
  if (!proposingResult.ok) {
    errors.push(proposingResult.error);
  }

  const receivingDropAnalysis = analyzeTradeDrops({
    roster: input.receivingRoster,
    offeringIds: input.receivingOfferIds,
    receiving: receivingReceiving,
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
  });

  if (
    receivingDropAnalysis.dropsNeeded === 0 ||
    input.receivingDropIds.length > 0
  ) {
    const receivingResult = validateTeamPostTrade({
      teamId: input.receivingTeamId,
      teamLabel: input.receivingTeamLabel,
      roster: input.receivingRoster,
      offeringIds: input.receivingOfferIds,
      receiving: receivingReceiving,
      dropIds: input.receivingDropIds,
      rosterSlots: input.rosterSlots,
      benchSlots: input.benchSlots,
      enforceRosterMinimums: input.enforceRosterMinimums,
    });
    if (!receivingResult.ok) {
      errors.push(receivingResult.error);
    }
  } else if (
    countFeasibleDropCandidates(receivingDropAnalysis) <
    receivingDropAnalysis.dropsNeeded
  ) {
    errors.push(
      `${input.receivingTeamLabel}: trade would require more drops than roster allows.`,
    );
  }

  if (
    !areTradeDropsSatisfied(
      proposingDropAnalysis,
      input.proposingDropIds,
      input.proposingRoster,
    )
  ) {
    errors.push(
      `${input.proposingTeamLabel}: select ${proposingDropAnalysis.dropsNeeded} player(s) to drop.`,
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    dropsRequired: [
      {
        teamId: input.proposingTeamId,
        count: proposingDropAnalysis.dropsNeeded,
      },
      {
        teamId: input.receivingTeamId,
        count: receivingDropAnalysis.dropsNeeded,
      },
    ],
  };
}

export function listDropCandidates(
  roster: TradeRosterPlayer[],
  offeringIds: string[],
  receiving: TradeRosterPlayer[],
  rosterSlots: RosterSlotConfig[] | null | undefined,
  benchSlots: number,
) {
  const analysis = analyzeTradeDrops({
    roster,
    offeringIds,
    receiving,
    rosterSlots,
    benchSlots,
  });
  return {
    needed: analysis.dropsNeeded,
    candidates: analysis.candidates,
    analysis,
  };
}

export function getPositionCapError(
  roster: TradeRosterPlayer[],
  rosterSlots: RosterSlotConfig[] | null | undefined,
  positionId: string,
) {
  const max = getPositionRosterMax(rosterSlots, positionId);
  if (max === Number.POSITIVE_INFINITY) {
    return null;
  }
  const count = roster.filter(
    (player) => player.primaryPositionId === positionId,
  ).length;
  if (count > max) {
    return `At max ${positionId}s (${max}).`;
  }
  return null;
}
