import type { ScoringPreset } from "@/lib/leagues/scoring/types";
import type { RankedPlayerRow } from "@/lib/queries/players";

const PRESET_STAT_KEYS: Record<ScoringPreset, string> = {
  standard: "pts_std",
  half_ppr: "pts_half_ppr",
  full_ppr: "pts_ppr",
};

export function getFantasyPointsFromPreset(
  row: Pick<RankedPlayerRow, "stats" | "ptsPpr" | "ptsStd">,
  preset: ScoringPreset,
): number | null {
  const key = PRESET_STAT_KEYS[preset];
  const raw =
    row.stats[key] ??
    (preset === "full_ppr"
      ? row.ptsPpr
      : preset === "standard"
        ? row.ptsStd
        : row.stats.pts_half_ppr);

  if (raw == null) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export const RANKINGS_SCORING_OPTIONS: {
  value: ScoringPreset;
  label: string;
}[] = [
  { value: "standard", label: "Default" },
  { value: "half_ppr", label: "Half PPR" },
  { value: "full_ppr", label: "Full PPR" },
];

export function parseScoringPreset(
  value: string | null | undefined,
): ScoringPreset {
  if (value === "standard" || value === "half_ppr" || value === "full_ppr") {
    return value;
  }

  return "full_ppr";
}
