import {
  getAdpForScoring,
  pickNeedAwarePlayer,
  type NeedAwarePlayer,
  type PickNeedAwarePlayerInput,
} from "@/lib/draft/need-aware-pick";
import type { MockDraftScoring } from "@/lib/mock-draft/settings";

export type MockDraftPlayer = NeedAwarePlayer;

export { getAdpForScoring };

export type PickBotPlayerInput = {
  available: MockDraftPlayer[];
  draftedPositions: string[];
  rosterSlots: PickNeedAwarePlayerInput["rosterSlots"];
  scoring: MockDraftScoring;
  picksRemainingForTeam: number;
  random?: () => number;
  /** Optional bye weeks aligned with draftedPositions (same index). */
  draftedByeWeeks?: Array<number | null | undefined>;
};

/**
 * Need-aware ADP bot: fills open starters by ADP, pads offense skill before
 * IDP, defers K/DEF until the last two picks, then BPA into bench. Prefers
 * avoiding same-position bye clashes when bye data is provided.
 */
export function pickBotPlayer(
  input: PickBotPlayerInput,
): MockDraftPlayer | null {
  const draftedRoster = input.draftedPositions.map((positionId, index) => ({
    primaryPositionId: positionId,
    byeWeek: input.draftedByeWeeks?.[index] ?? null,
  }));

  return pickNeedAwarePlayer({
    available: input.available,
    draftedRoster,
    rosterSlots: input.rosterSlots,
    scoring: input.scoring,
    picksRemainingForTeam: input.picksRemainingForTeam,
    random: input.random,
  });
}
