import type { LeagueActivityMetadata } from "@/db/schema/league-activity";

export type ClaimResolutionEntry = {
  teamId: string;
  teamName: string;
  bid: number | null;
  waiverPriority: number;
  status: "won" | "lost" | "illegal_roster";
  failReason?: string | null;
};

export function isIllegalRosterFailReason(
  reason: string | null | undefined,
): boolean {
  if (!reason?.trim()) return false;
  const normalized = reason.trim().toLowerCase();
  if (normalized === "illegal roster.") return true;
  if (normalized.includes("illegal roster")) return true;
  if (normalized.includes("at max")) return true;
  if (normalized.includes("roster is full")) return true;
  if (normalized.includes("required drop")) return true;
  if (normalized.includes("not eligible for ir")) return true;
  if (normalized.includes("lineup")) return true;
  return false;
}

/** Human label for activity / tooltip rows. */
export function formatClaimResolutionFailLabel(
  reason: string | null | undefined,
): string | null {
  if (!reason?.trim()) return null;
  if (isIllegalRosterFailReason(reason)) return "illegal roster";
  return reason.trim().replace(/\.$/, "");
}

export function orderClaimsForResolution<
  T extends {
    teamId: string;
    bid: number | null;
    waiverPriority: number;
    createdAt: Date;
  },
>(claims: T[], waiverType: "priority" | "faab"): T[] {
  return [...claims].sort((a, b) => {
    if (waiverType === "faab") {
      const bidDiff = (b.bid ?? 0) - (a.bid ?? 0);
      if (bidDiff !== 0) return bidDiff;
    }
    if (a.waiverPriority !== b.waiverPriority) {
      return a.waiverPriority - b.waiverPriority;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export function buildClaimResolution(input: {
  claims: Array<{
    id: string;
    teamId: string;
    bid: number | null;
    waiverPriority: number;
    createdAt: Date;
  }>;
  teamNameById: Map<string, string>;
  statusByClaimId: Map<
    string,
    { status: "awarded" | "failed"; failReason?: string | null }
  >;
  waiverType: "priority" | "faab";
}): ClaimResolutionEntry[] {
  const ordered = orderClaimsForResolution(input.claims, input.waiverType);
  return ordered.map((claim) => {
    const result = input.statusByClaimId.get(claim.id);
    const failReason = result?.failReason ?? null;
    let status: ClaimResolutionEntry["status"] = "lost";
    if (result?.status === "awarded") {
      status = "won";
    } else if (isIllegalRosterFailReason(failReason)) {
      status = "illegal_roster";
    }
    return {
      teamId: claim.teamId,
      teamName: input.teamNameById.get(claim.teamId)?.trim() || "A team",
      bid: claim.bid,
      waiverPriority: claim.waiverPriority,
      status,
      failReason,
    };
  });
}

export function withClaimResolutionMetadata(
  metadata: LeagueActivityMetadata,
  claimResolution: ClaimResolutionEntry[],
): LeagueActivityMetadata {
  return {
    ...metadata,
    claimCount: claimResolution.length,
    claimResolution,
  };
}
