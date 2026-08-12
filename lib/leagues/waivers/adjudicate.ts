export type PendingClaimForProcess = {
  id: string;
  teamId: string;
  playerId: string;
  dropPlayerId: string | null;
  bid: number | null;
  createdAt: Date;
  sortOrder: number;
  waiverPriority: number;
  faabRemaining: number | null;
};

export type ClaimProcessOutcome = {
  claimId: string;
  status: "awarded" | "failed";
  failReason?: string;
};

export type ProcessClaimsResult = {
  outcomes: ClaimProcessOutcome[];
  /**
   * Team ids for each successful award in process order (duplicates allowed).
   * Used to apply sequential move-to-bottom priority updates.
   */
  winnersInOrder: string[];
  /** FAAB deductions by team id. */
  faabSpendByTeam: Map<string, number>;
};

/**
 * Adjudicate pending claims.
 *
 * Priority (rolling):
 * - Teams process in current waiver-priority order.
 * - Each turn, a team is awarded their first remaining claim whose player is still free.
 * - That team moves to the bottom of the queue and may win again later in the same run.
 * - Contested players are not orphaned: if WP1 takes someone else later, WP2 can still get them
 *   only if WP1 did not already take that player on an earlier turn.
 *
 * FAAB:
 * - Each player is resolved independently (highest bid; ties → better WP, then earlier createdAt).
 * - Teams may win multiple players; there is no per-team demotion pass.
 */
export function adjudicateWaiverClaims(input: {
  claims: PendingClaimForProcess[];
  waiverType: "priority" | "faab";
}): ProcessClaimsResult {
  if (input.waiverType === "faab") {
    return adjudicateFaabClaims(input.claims);
  }
  return adjudicatePriorityClaims(input.claims);
}

function adjudicatePriorityClaims(
  claims: PendingClaimForProcess[],
): ProcessClaimsResult {
  const outcomes: ClaimProcessOutcome[] = [];
  const winnersInOrder: string[] = [];
  const resolved = new Set<string>();
  const takenPlayers = new Set<string>();

  const claimsByTeam = new Map<string, PendingClaimForProcess[]>();
  for (const claim of claims) {
    const list = claimsByTeam.get(claim.teamId) ?? [];
    list.push(claim);
    claimsByTeam.set(claim.teamId, list);
  }

  for (const list of claimsByTeam.values()) {
    list.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  const teamPriority = (teamId: string) => {
    const list = claimsByTeam.get(teamId) ?? [];
    return list.reduce(
      (best, claim) => Math.min(best, claim.waiverPriority),
      Number.POSITIVE_INFINITY,
    );
  };

  const queue = [...claimsByTeam.keys()].sort((a, b) => {
    const priorityDiff = teamPriority(a) - teamPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return a.localeCompare(b);
  });

  const unresolvedFor = (teamId: string) =>
    (claimsByTeam.get(teamId) ?? []).filter((claim) => !resolved.has(claim.id));

  let guard = claims.length + queue.length + 1;
  while (queue.length > 0 && guard > 0) {
    guard -= 1;
    const teamId = queue.shift()!;
    const pending = unresolvedFor(teamId);
    if (pending.length === 0) {
      continue;
    }

    let awarded: PendingClaimForProcess | null = null;
    for (const claim of pending) {
      if (takenPlayers.has(claim.playerId)) {
        outcomes.push({
          claimId: claim.id,
          status: "failed",
          failReason: "Lower waiver priority.",
        });
        resolved.add(claim.id);
        continue;
      }
      awarded = claim;
      break;
    }

    if (!awarded) {
      continue;
    }

    outcomes.push({ claimId: awarded.id, status: "awarded" });
    resolved.add(awarded.id);
    takenPlayers.add(awarded.playerId);
    winnersInOrder.push(teamId);

    for (const other of claims) {
      if (
        other.playerId !== awarded.playerId ||
        other.id === awarded.id ||
        resolved.has(other.id)
      ) {
        continue;
      }
      outcomes.push({
        claimId: other.id,
        status: "failed",
        failReason: "Lower waiver priority.",
      });
      resolved.add(other.id);
    }

    if (unresolvedFor(teamId).length > 0) {
      queue.push(teamId);
    }
  }

  for (const claim of claims) {
    if (resolved.has(claim.id)) continue;
    outcomes.push({
      claimId: claim.id,
      status: "failed",
      failReason: "Claim was not processed.",
    });
  }

  return {
    outcomes,
    winnersInOrder,
    faabSpendByTeam: new Map(),
  };
}

function adjudicateFaabClaims(
  claims: PendingClaimForProcess[],
): ProcessClaimsResult {
  const outcomes: ClaimProcessOutcome[] = [];
  const winnersInOrder: string[] = [];
  const faabSpendByTeam = new Map<string, number>();

  const byPlayer = new Map<string, PendingClaimForProcess[]>();
  for (const claim of claims) {
    const list = byPlayer.get(claim.playerId) ?? [];
    list.push(claim);
    byPlayer.set(claim.playerId, list);
  }

  for (const playerId of [...byPlayer.keys()].sort()) {
    const playerClaims = byPlayer.get(playerId) ?? [];
    const eligible = playerClaims.filter((claim) => {
      const bid = claim.bid ?? 0;
      const spent = faabSpendByTeam.get(claim.teamId) ?? 0;
      const budget = claim.faabRemaining ?? 0;
      if (bid > budget - spent) {
        outcomes.push({
          claimId: claim.id,
          status: "failed",
          failReason: "Bid exceeds remaining FAAB.",
        });
        return false;
      }
      return true;
    });

    if (eligible.length === 0) {
      continue;
    }

    const winner = pickFaabWinner(eligible);
    winnersInOrder.push(winner.teamId);
    faabSpendByTeam.set(
      winner.teamId,
      (faabSpendByTeam.get(winner.teamId) ?? 0) + (winner.bid ?? 0),
    );

    for (const claim of eligible) {
      if (claim.id === winner.id) {
        outcomes.push({ claimId: claim.id, status: "awarded" });
      } else {
        outcomes.push({
          claimId: claim.id,
          status: "failed",
          failReason: "Outbid.",
        });
      }
    }
  }

  for (const claim of claims) {
    if (!outcomes.some((row) => row.claimId === claim.id)) {
      outcomes.push({
        claimId: claim.id,
        status: "failed",
        failReason: "Claim was not processed.",
      });
    }
  }

  return { outcomes, winnersInOrder, faabSpendByTeam };
}

function pickFaabWinner(claims: PendingClaimForProcess[]): PendingClaimForProcess {
  const sorted = [...claims].sort((a, b) => {
    const bidDiff = (b.bid ?? 0) - (a.bid ?? 0);
    if (bidDiff !== 0) return bidDiff;
    if (a.waiverPriority !== b.waiverPriority) {
      return a.waiverPriority - b.waiverPriority;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return sorted[0]!;
}

/**
 * Apply each award as a move-to-bottom, in process order.
 * The same team may appear multiple times when they win more than once.
 */
export function moveWinnersToBottom(
  priorities: Array<{ teamId: string; waiverPriority: number }>,
  winnersInOrder: string[],
): Array<{ teamId: string; waiverPriority: number }> {
  let ordered = priorities
    .slice()
    .sort((a, b) => a.waiverPriority - b.waiverPriority);

  if (winnersInOrder.length === 0) {
    return ordered.map((row, index) => ({
      teamId: row.teamId,
      waiverPriority: index + 1,
    }));
  }

  for (const winnerId of winnersInOrder) {
    const winner = ordered.find((row) => row.teamId === winnerId);
    if (!winner) continue;
    ordered = [
      ...ordered.filter((row) => row.teamId !== winnerId),
      winner,
    ];
  }

  return ordered.map((row, index) => ({
    teamId: row.teamId,
    waiverPriority: index + 1,
  }));
}
