import { isIdpPosition } from "@/lib/leagues/idp-positions";

function num(
  bag: Record<string, number | null>,
  key: string,
): number {
  const value = bag[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

/**
 * NFL position aggregate from actual player stat bags (not fantasy points).
 * Rates are volume-weighted across player-weeks: sum(num) / sum(den).
 * Percent metrics return 0–100 to match Overview meters.
 */
export function computeNflPositionAverage(
  positionId: string,
  bags: Array<Record<string, number | null> | null | undefined>,
): number | null {
  let numerator = 0;
  let denominator = 0;

  for (const bag of bags) {
    if (!bag) continue;

    if (positionId === "QB") {
      const att = num(bag, "pass_att");
      if (att <= 0) continue;
      numerator += num(bag, "pass_cmp");
      denominator += att;
      continue;
    }

    if (positionId === "WR" || positionId === "TE") {
      const tgt = num(bag, "rec_tgt");
      if (tgt <= 0) continue;
      numerator += num(bag, "rec");
      denominator += tgt;
      continue;
    }

    if (positionId === "RB") {
      const att = num(bag, "rush_att");
      if (att <= 0) continue;
      numerator += num(bag, "rush_yd");
      denominator += att;
      continue;
    }

    if (isIdpPosition(positionId)) {
      const solo = num(bag, "tkl_solo");
      const assist = num(bag, "tkl_ast");
      const tackles = solo + assist;
      if (tackles <= 0) continue;
      numerator += solo;
      denominator += tackles;
      continue;
    }

    if (positionId === "K") {
      const made = num(bag, "fgm") + num(bag, "xpm");
      const attempts = num(bag, "fga") + num(bag, "xpa");
      if (made <= 0 && attempts <= 0) continue;
      numerator += made;
      denominator += 1;
      continue;
    }

    if (positionId === "DEF") {
      const ptsAllow = bag.pts_allow;
      if (typeof ptsAllow !== "number" || !Number.isFinite(ptsAllow)) continue;
      numerator += ptsAllow;
      denominator += 1;
    }
  }

  const value = ratio(numerator, denominator);
  if (value == null) return null;

  if (
    positionId === "QB" ||
    positionId === "WR" ||
    positionId === "TE" ||
    isIdpPosition(positionId)
  ) {
    return value * 100;
  }

  return value;
}
