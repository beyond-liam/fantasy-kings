import type { DraftStyle } from "@/db/schema/league-seasons";

function roundOrdinal(round: number): string {
  const n = Math.trunc(round);
  const mod100 = n % 100;
  const mod10 = n % 10;
  let suffix = "th";
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suffix = "st";
    else if (mod10 === 2) suffix = "nd";
    else if (mod10 === 3) suffix = "rd";
  }
  return `${n}${suffix}`;
}

/** `1.04` — round and original-team draft slot. */
export function formatResolvedPickSlot(round: number, slot: number): string {
  const r = Math.max(1, Math.trunc(round));
  const s = Math.max(1, Math.trunc(slot));
  return `${r}.${String(s).padStart(2, "0")}`;
}

export function formatUnresolvedPickLabel(input: {
  draftYear: number;
  round: number;
  viaTeamName?: string | null;
}): string {
  const base = `${Math.trunc(input.draftYear)} ${roundOrdinal(input.round)}`;
  const via = input.viaTeamName?.trim();
  return via ? `${base} (via ${via})` : base;
}

export function overallFromDraftSlot(input: {
  round: number;
  draftSlot: number;
  teamCount: number;
  style: DraftStyle;
}): number {
  const teamCount = Math.max(1, Math.trunc(input.teamCount));
  const round = Math.max(1, Math.trunc(input.round));
  const draftSlot = Math.min(
    teamCount,
    Math.max(1, Math.trunc(input.draftSlot)),
  );
  const pickInRound =
    input.style === "snake" && round % 2 === 0
      ? teamCount - draftSlot + 1
      : draftSlot;
  return (round - 1) * teamCount + pickInRound;
}

export function pickSlotAndOverall(input: {
  round: number;
  draftSlot: number;
  teamCount: number;
  style: DraftStyle;
}): { slot: number; overall: number } {
  const slot = Math.max(1, Math.trunc(input.draftSlot));
  return {
    slot,
    overall: overallFromDraftSlot(input),
  };
}

export type DynastyPickLabel = {
  primary: string;
  secondary: string | null;
  resolved: boolean;
};

/**
 * Resolved when slot/overall is stored, or the pick is for the current
 * season and the original team already has a draft slot.
 */
export function dynastyPickLabel(input: {
  draftYear: number;
  round: number;
  slot: number | null;
  originalTeamName: string;
  isOriginalOwner: boolean;
  currentSeasonYear: number;
  originalTeamDraftSlot: number | null;
}): DynastyPickLabel {
  const via = input.isOriginalOwner ? null : input.originalTeamName;
  const unresolved = formatUnresolvedPickLabel({
    draftYear: input.draftYear,
    round: input.round,
    viaTeamName: via,
  });

  const storedSlot =
    input.slot != null && Number.isFinite(input.slot) && input.slot > 0
      ? Math.trunc(input.slot)
      : null;
  const inferredSlot =
    storedSlot == null &&
    input.draftYear === input.currentSeasonYear &&
    input.originalTeamDraftSlot != null &&
    input.originalTeamDraftSlot > 0
      ? Math.trunc(input.originalTeamDraftSlot)
      : null;
  const slot = storedSlot ?? inferredSlot;

  if (slot == null) {
    return { primary: unresolved, secondary: null, resolved: false };
  }

  return {
    primary: formatResolvedPickSlot(input.round, slot),
    secondary: unresolved,
    resolved: true,
  };
}

export function uniqueDraftPickYears(years: number[]): number[] {
  return [...new Set(years)].toSorted((a, b) => a - b);
}
