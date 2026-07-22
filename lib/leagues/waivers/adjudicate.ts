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
  /** Winning team ids in process order (for priority bottom-moves). */
  winnersInOrder: string[];
  /** FAAB deductions by team id. */
  faabSpendByTeam: Map<string, number>;
};

/**
 * Adjudicate pending claims.
 * - Priority: lower waiverPriority wins; ties → earlier createdAt.
 * - FAAB: higher bid wins; ties → better (lower) priority, then earlier createdAt.
 * - Per team, only the best (lowest sortOrder) awarded claim is kept; others fail.
 * Winner goes to bottom externally after this returns.
 */
export function adjudicateWaiverClaims(input: {
  claims: PendingClaimForProcess[];
  waiverType: "priority" | "faab";
}): ProcessClaimsResult {
  const outcomes: ClaimProcessOutcome[] = [];
  const winnersInOrder: string[] = [];
  const faabSpendByTeam = new Map<string, number>();
  const teamsAlreadyMoved: Set<string> = new Set();

  const byPlayer = new Map<string, PendingClaimForProcess[]>();
  for (const claim of input.claims) {
    const list = byPlayer.get(claim.playerId) ?? [];
    list.push(claim);
    byPlayer.set(claim.playerId, list);
  }

  const playerIds = [...byPlayer.keys()].sort();

  for (const playerId of playerIds) {
    const claims = byPlayer.get(playerId) ?? [];
    const eligible = claims.filter((claim) => {
      if (input.waiverType === "faab") {
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
      }
      return true;
    });

    if (eligible.length === 0) {
      continue;
    }

    const winner = pickWinner(eligible, input.waiverType);
    if (!teamsAlreadyMoved.has(winner.teamId)) {
      winnersInOrder.push(winner.teamId);
      teamsAlreadyMoved.add(winner.teamId);
    }

    if (input.waiverType === "faab") {
      const bid = winner.bid ?? 0;
      faabSpendByTeam.set(
        winner.teamId,
        (faabSpendByTeam.get(winner.teamId) ?? 0) + bid,
      );
    }

    for (const claim of eligible) {
      if (claim.id === winner.id) {
        outcomes.push({ claimId: claim.id, status: "awarded" });
      } else {
        outcomes.push({
          claimId: claim.id,
          status: "failed",
          failReason:
            input.waiverType === "faab" ? "Outbid." : "Lower waiver priority.",
        });
      }
    }
  }

  // Any claim not yet recorded (shouldn't happen) fails closed.
  for (const claim of input.claims) {
    if (!outcomes.some((row) => row.claimId === claim.id)) {
      outcomes.push({
        claimId: claim.id,
        status: "failed",
        failReason: "Claim was not processed.",
      });
    }
  }

  const claimById = new Map(input.claims.map((claim) => [claim.id, claim]));
  const awardedByTeam = new Map<string, string[]>();
  for (const outcome of outcomes) {
    if (outcome.status !== "awarded") continue;
    const claim = claimById.get(outcome.claimId);
    if (!claim) continue;
    const list = awardedByTeam.get(claim.teamId) ?? [];
    list.push(claim.id);
    awardedByTeam.set(claim.teamId, list);
  }

  for (const [, claimIds] of awardedByTeam) {
    if (claimIds.length < 2) continue;
    const preferred = claimIds
      .map((id) => claimById.get(id)!)
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.createdAt.getTime() - b.createdAt.getTime();
      })[0]!;

    for (const claimId of claimIds) {
      if (claimId === preferred.id) continue;
      const index = outcomes.findIndex((row) => row.claimId === claimId);
      if (index < 0) continue;
      outcomes[index] = {
        claimId,
        status: "failed",
        failReason: "Higher-priority claim succeeded.",
      };
      const claim = claimById.get(claimId);
      if (claim && input.waiverType === "faab") {
        const bid = claim.bid ?? 0;
        faabSpendByTeam.set(
          claim.teamId,
          Math.max(0, (faabSpendByTeam.get(claim.teamId) ?? 0) - bid),
        );
      }
    }
  }

  return { outcomes, winnersInOrder, faabSpendByTeam };
}

function pickWinner(
  claims: PendingClaimForProcess[],
  waiverType: "priority" | "faab",
): PendingClaimForProcess {
  const sorted = [...claims].sort((a, b) => {
    if (waiverType === "faab") {
      const bidDiff = (b.bid ?? 0) - (a.bid ?? 0);
      if (bidDiff !== 0) return bidDiff;
    }
    if (a.waiverPriority !== b.waiverPriority) {
      return a.waiverPriority - b.waiverPriority;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return sorted[0]!;
}

/** Move winning teams to the bottom of the priority queue, preserving relative order of winners. */
export function moveWinnersToBottom(
  priorities: Array<{ teamId: string; waiverPriority: number }>,
  winnersInOrder: string[],
): Array<{ teamId: string; waiverPriority: number }> {
  if (winnersInOrder.length === 0) {
    return priorities
      .slice()
      .sort((a, b) => a.waiverPriority - b.waiverPriority)
      .map((row, index) => ({ ...row, waiverPriority: index + 1 }));
  }

  const winnerSet = new Set(winnersInOrder);
  const ordered = priorities
    .slice()
    .sort((a, b) => a.waiverPriority - b.waiverPriority);

  const remaining = ordered.filter((row) => !winnerSet.has(row.teamId));
  const winners = winnersInOrder
    .map((teamId) => ordered.find((row) => row.teamId === teamId))
    .filter((row): row is { teamId: string; waiverPriority: number } =>
      Boolean(row),
    );

  return [...remaining, ...winners].map((row, index) => ({
    teamId: row.teamId,
    waiverPriority: index + 1,
  }));
}
