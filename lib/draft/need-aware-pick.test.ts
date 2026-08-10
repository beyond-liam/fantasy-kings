import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import {
  pickNeedAwarePlayer,
  type NeedAwarePlayer,
} from "@/lib/draft/need-aware-pick";
import { buildStandardRosterSlots } from "@/lib/leagues/defaults";
import { getDefaultIdpCustomRosterSlots } from "@/lib/leagues/roster";

function player(
  id: string,
  position: string,
  adp: number,
  byeWeek: number | null = null,
): NeedAwarePlayer {
  return {
    id,
    fullName: id,
    primaryPositionId: position,
    nflTeam: "DET",
    fantasyPts: 100 - adp,
    byeWeek,
    stats: { adp_ppr: adp, adp_half_ppr: adp, adp_std: adp },
  };
}

function idpRosterSlots(): RosterSlotConfig[] {
  return [
    ...getDefaultIdpCustomRosterSlots().map((slot) => ({
      ...slot,
      maxSlots: Math.max(slot.maxSlots, slot.slotCount + 4),
    })),
    {
      positionId: "BN",
      slotCount: 4,
      minSlots: 0,
      maxSlots: 4,
      isStarter: false,
    },
  ];
}

describe("pickNeedAwarePlayer", () => {
  const rosterSlots = buildStandardRosterSlots(6, 0, 0);

  it("prefers best ADP at a position of need over BPA of another position", () => {
    const pick = pickNeedAwarePlayer({
      available: [player("wr1", "WR", 5), player("qb1", "QB", 40)],
      draftedRoster: [],
      rosterSlots,
      scoring: "full_ppr",
      picksRemainingForTeam: 15,
      random: () => 0,
    });
    assert.equal(pick?.id, "wr1");
  });

  it("fills open TE need instead of stacking QB when TE is empty", () => {
    const pick = pickNeedAwarePlayer({
      available: [player("qb2", "QB", 45), player("te1", "TE", 55)],
      draftedRoster: [
        { primaryPositionId: "QB", byeWeek: 9 },
        { primaryPositionId: "RB", byeWeek: 5 },
        { primaryPositionId: "RB", byeWeek: 7 },
        { primaryPositionId: "WR", byeWeek: 6 },
        { primaryPositionId: "WR", byeWeek: 8 },
      ],
      rosterSlots,
      scoring: "full_ppr",
      picksRemainingForTeam: 10,
      random: () => 0,
    });
    assert.equal(pick?.id, "te1");
  });

  it("defers K and DEF until late picks", () => {
    const early = pickNeedAwarePlayer({
      available: [
        player("k1", "K", 1),
        player("def1", "DEF", 2),
        player("rb1", "RB", 50),
      ],
      draftedRoster: [],
      rosterSlots,
      scoring: "full_ppr",
      picksRemainingForTeam: 10,
      random: () => 0,
    });
    assert.equal(early?.id, "rb1");

    const late = pickNeedAwarePlayer({
      available: [
        player("k1", "K", 1),
        player("def1", "DEF", 2),
        player("rb1", "RB", 50),
      ],
      draftedRoster: [
        { primaryPositionId: "QB" },
        { primaryPositionId: "RB" },
        { primaryPositionId: "RB" },
        { primaryPositionId: "WR" },
        { primaryPositionId: "WR" },
        { primaryPositionId: "TE" },
        { primaryPositionId: "RB" },
      ],
      rosterSlots,
      scoring: "full_ppr",
      picksRemainingForTeam: 2,
      random: () => 0,
    });
    assert.ok(late?.id === "k1" || late?.id === "def1");
  });

  it("defers IDP while offense skill starters are still open", () => {
    const slots = idpRosterSlots();
    const early = pickNeedAwarePlayer({
      available: [player("edge", "DE", 8), player("wr1", "WR", 25)],
      draftedRoster: [],
      rosterSlots: slots,
      scoring: "full_ppr",
      picksRemainingForTeam: 20,
      random: () => 0,
    });
    assert.equal(early?.id, "wr1");
  });

  it("takes IDP after offense skill starters are filled", () => {
    const slots = idpRosterSlots();
    const pick = pickNeedAwarePlayer({
      available: [player("edge", "DE", 30), player("rb-depth", "RB", 55)],
      draftedRoster: [
        { primaryPositionId: "QB" },
        { primaryPositionId: "RB" },
        { primaryPositionId: "RB" },
        { primaryPositionId: "WR" },
        { primaryPositionId: "WR" },
        { primaryPositionId: "TE" },
        { primaryPositionId: "RB" },
      ],
      rosterSlots: slots,
      scoring: "full_ppr",
      picksRemainingForTeam: 12,
      random: () => 0,
    });
    assert.equal(pick?.id, "edge");
  });

  it("fills open QB need when skill positions are already stacked", () => {
    const pick = pickNeedAwarePlayer({
      available: [player("wr3", "WR", 10), player("qb1", "QB", 60)],
      draftedRoster: [
        { primaryPositionId: "RB" },
        { primaryPositionId: "RB" },
        { primaryPositionId: "WR" },
        { primaryPositionId: "WR" },
        { primaryPositionId: "TE" },
        { primaryPositionId: "RB" },
      ],
      rosterSlots,
      scoring: "full_ppr",
      picksRemainingForTeam: 8,
      random: () => 0,
    });
    assert.equal(pick?.id, "qb1");
  });

  it("avoids same-position bye clash when drafting a second QB", () => {
    const pick = pickNeedAwarePlayer({
      available: [
        player("qb-clash", "QB", 80, 9),
        player("qb-ok", "QB", 85, 12),
      ],
      draftedRoster: [
        { primaryPositionId: "QB", byeWeek: 9 },
        { primaryPositionId: "RB", byeWeek: 5 },
        { primaryPositionId: "RB", byeWeek: 7 },
        { primaryPositionId: "WR", byeWeek: 6 },
        { primaryPositionId: "WR", byeWeek: 8 },
        { primaryPositionId: "TE", byeWeek: 10 },
        { primaryPositionId: "RB", byeWeek: 11 },
      ],
      rosterSlots,
      scoring: "full_ppr",
      picksRemainingForTeam: 6,
      random: () => 0,
    });
    assert.equal(pick?.id, "qb-ok");
  });

  it("falls back to BPA when ADP is missing", () => {
    const highPts: NeedAwarePlayer = {
      id: "bpa",
      fullName: "bpa",
      primaryPositionId: "RB",
      nflTeam: "DET",
      fantasyPts: 250,
      byeWeek: 5,
      stats: {},
    };
    const lowPts: NeedAwarePlayer = {
      id: "low",
      fullName: "low",
      primaryPositionId: "RB",
      nflTeam: "DET",
      fantasyPts: 100,
      byeWeek: 6,
      stats: {},
    };
    const pick = pickNeedAwarePlayer({
      available: [lowPts, highPts],
      draftedRoster: [],
      rosterSlots,
      scoring: "full_ppr",
      picksRemainingForTeam: 12,
      random: () => 0,
    });
    assert.equal(pick?.id, "bpa");
  });
});
