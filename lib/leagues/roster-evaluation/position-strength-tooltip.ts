import { formatOrdinalRank } from "@/lib/leagues/roster-evaluation/rank";
import type { PositionStrengthPoint } from "@/lib/leagues/roster-evaluation/types";

export type PositionStrengthTooltipPart =
  | { kind: "text"; value: string }
  | { kind: "rank"; value: string };

/**
 * Sentence parts for the Position Strength radar tooltip.
 * Rank ordinals use `kind: "rank"` so the UI can render them semibold.
 */
export function buildPositionStrengthTooltipParts(
  point: PositionStrengthPoint,
): PositionStrengthTooltipPart[] {
  const pos = point.position;
  const starterOrd = formatOrdinalRank(point.startersRank);
  const benchOrd = formatOrdinalRank(point.benchRank);

  if (point.hasStarters && point.hasBench) {
    return [
      { kind: "text", value: `Your starting ${pos} ranks ` },
      { kind: "rank", value: starterOrd },
      { kind: "text", value: " against the league while your bench ranks " },
      { kind: "rank", value: benchOrd },
      { kind: "text", value: "." },
    ];
  }

  if (point.hasStarters) {
    return [
      { kind: "text", value: `Your starting ${pos} ranks ` },
      { kind: "rank", value: starterOrd },
      { kind: "text", value: ` against the league. You have no bench ${pos}.` },
    ];
  }

  if (point.hasBench) {
    return [
      { kind: "text", value: `You have no starting ${pos}. Your bench ranks ` },
      { kind: "rank", value: benchOrd },
      { kind: "text", value: " against the league." },
    ];
  }

  return [
    {
      kind: "text",
      value: `You have no starting or bench ${pos}.`,
    },
  ];
}
