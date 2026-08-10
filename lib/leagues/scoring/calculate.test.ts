import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculatePlayerPoints,
  type PlayerStatBag,
} from "@/lib/leagues/scoring/calculate";
import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import type {
  ScoringPosition,
  ScoringRuleDefinition,
} from "@/lib/leagues/scoring/types";

describe("calculatePlayerPoints", () => {
  describe("simple rule (direct multiplication)", () => {
    it("calculates points for touchdown", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "rush-td",
          category: "rushing",
          kind: "simple",
          points: 6,
          stat: "Rushing TD",
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        rush_td: 2,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 12);
    });

    it("handles negative points for turnovers", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "fumble-lost",
          category: "misc",
          kind: "simple",
          points: -1,
          stat: "Fumble Lost",
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        fum_lost: 2,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, -2);
    });
  });

  describe("per_unit rule (yards with every)", () => {
    it("calculates yards per 10 with every", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "rush-yds",
          category: "rushing",
          kind: "per_unit",
          points: 1,
          stat: "Rushing Yards",
          every: 10,
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        rush_yd: 125,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 12.5);
    });

    it("calculates yards per 10 with rate", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "rush-yds",
          category: "rushing",
          kind: "per_unit",
          points: 1,
          stat: "Rushing Yards",
          every: 10,
          rate: 0.1,
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        rush_yd: 125,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 12.5);
    });
  });

  describe("threshold rule (bonus at threshold)", () => {
    it("awards bonus when threshold met", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "rush-yds-150",
          category: "rushing",
          kind: "threshold",
          points: 3,
          stat: "Rushing Yards",
          threshold: 150,
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        rush_yd: 175,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 3);
    });

    it("awards no bonus when threshold not met", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "rush-yds-150",
          category: "rushing",
          kind: "threshold",
          points: 3,
          stat: "Rushing Yards",
          threshold: 150,
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        rush_yd: 149,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 0);
    });
  });

  describe("threshold_lte rule (bonus at or below max)", () => {
    it("awards bonus when at or below maxThreshold", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "low-turnovers",
          category: "misc",
          kind: "threshold_lte",
          points: 2,
          stat: "Fumble Lost",
          maxThreshold: 1,
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        fum_lost: 1,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 2);
    });

    it("awards no bonus when above maxThreshold", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "low-turnovers",
          category: "misc",
          kind: "threshold_lte",
          points: 2,
          stat: "Fumble Lost",
          maxThreshold: 1,
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        fum_lost: 2,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 0);
    });
  });

  describe("threshold_between rule (bonus in range)", () => {
    it("awards bonus when in range", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "yards-range",
          category: "rushing",
          kind: "threshold_between",
          points: 2,
          stat: "Rushing Yards",
          threshold: 100,
          maxThreshold: 149,
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        rush_yd: 125,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 2);
    });

    it("awards no bonus when below range", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "yards-range",
          category: "rushing",
          kind: "threshold_between",
          points: 2,
          stat: "Rushing Yards",
          threshold: 100,
          maxThreshold: 149,
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        rush_yd: 99,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 0);
    });

    it("awards no bonus when above range", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "yards-range",
          category: "rushing",
          kind: "threshold_between",
          points: 2,
          stat: "Rushing Yards",
          threshold: 100,
          maxThreshold: 149,
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        rush_yd: 150,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 0);
    });
  });

  describe("exact rule (bonus for exact value)", () => {
    it("awards bonus for exact match (shutout)", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "shutout",
          category: "defense",
          kind: "exact",
          points: 10,
          stat: "Points Allowed",
          exactValue: 0,
          positions: ["DEF" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        // resolveDistanceStatKey returns pts_allow_0 for exactValue: 0
        pts_allow_0: 1, // Defense achieved shutout
      };
      const result = calculatePlayerPoints(stats, "DEF", rules);
      assert.equal(result, 10);
    });

    it("awards no bonus when not exact match", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "shutout",
          category: "defense",
          kind: "exact",
          points: 10,
          stat: "Points Allowed",
          exactValue: 0,
          positions: ["DEF" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        pts_allow_0: 0, // No shutout
      };
      const result = calculatePlayerPoints(stats, "DEF", rules);
      assert.equal(result, 0);
    });
  });

  describe("td_range rule (bonus by yards for field goals)", () => {
    it("awards bonus for field goals in yard range", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "fg-40-49",
          category: "kicking",
          kind: "td_range",
          points: 1,
          stat: "Field Goal Made",
          minYards: 40,
          maxYards: 49,
          positions: ["K" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        // resolveDistanceStatKey returns fgm_40_49 for this range
        fgm_40_49: 2, // Made 2 field goals in 40-49 yard range
      };
      const result = calculatePlayerPoints(stats, "K", rules);
      assert.equal(result, 2);
    });
  });

  describe("td_min_yards rule (bonus over min yards for field goals)", () => {
    it("awards bonus for field goals over min yards", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "fg-50",
          category: "kicking",
          kind: "td_min_yards",
          points: 3,
          stat: "Field Goal Made",
          minYards: 50,
          positions: ["K" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        // resolveDistanceStatKey returns fgm_50p for 50+ yards
        fgm_50p: 1, // Made 1 field goal 50+ yards
      };
      const result = calculatePlayerPoints(stats, "K", rules);
      assert.equal(result, 3);
    });
  });

  describe("position filtering", () => {
    it("excludes rules that do not apply to position", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "pass-td",
          category: "passing",
          kind: "simple",
          points: 4,
          stat: "Passing TD",
          positions: ["QB" as ScoringPosition],
        },
        {
          id: "rush-td",
          category: "rushing",
          kind: "simple",
          points: 6,
          stat: "Rushing TD",
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        pass_td: 3,
        rush_td: 2,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 12); // Only rush TDs count for RB
    });

    it("returns 0 when no rules apply to position", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "pass-td",
          category: "passing",
          kind: "simple",
          points: 4,
          stat: "Passing TD",
          positions: ["QB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        pass_td: 3,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 0);
    });
  });

  describe("null and undefined stat handling", () => {
    it("treats null stat as 0", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "rush-td",
          category: "rushing",
          kind: "simple",
          points: 6,
          stat: "Rushing TD",
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        rush_td: null,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 0);
    });

    it("treats undefined stat as 0", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "rush-td",
          category: "rushing",
          kind: "simple",
          points: 6,
          stat: "Rushing TD",
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {};
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 0);
    });

    it("treats NaN stat as 0", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "rush-td",
          category: "rushing",
          kind: "simple",
          points: 6,
          stat: "Rushing TD",
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        rush_td: NaN,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 0);
    });

    it("treats Infinity stat as 0", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "rush-td",
          category: "rushing",
          kind: "simple",
          points: 6,
          stat: "Rushing TD",
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        rush_td: Infinity,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      assert.equal(result, 0);
    });
  });

  describe("golden path: full_ppr RB receiving game", () => {
    it("calculates correct total for RB with catches, yards, and TD", () => {
      // Use full_ppr rules (1 point per reception)
      const rules = getDefaultScoringRuleDefinitions("full_ppr");

      // Realistic RB receiving game:
      // 8 catches, 75 receiving yards, 1 receiving TD
      const stats: PlayerStatBag = {
        rec: 8, // 8 receptions
        rec_yd: 75, // 75 receiving yards
        rec_td: 1, // 1 receiving TD
      };

      const result = calculatePlayerPoints(stats, "RB", rules);

      // Expected breakdown:
      // - Receptions: 8 × 1 = 8 (full PPR)
      // - Receiving yards: floor(75 / 10) × 1 = 7 (7.5 yards per point)
      // - Receiving TD: 1 × 6 = 6
      // Total: 8 + 7.5 + 6 = 21.5
      assert.equal(result, 21.5);
    });

    it("calculates correct total for RB with high-volume receiving", () => {
      const rules = getDefaultScoringRuleDefinitions("full_ppr");

      // High-volume pass-catching RB:
      // 12 catches (triggers 9+ bonus), 102 receiving yards, 1 receiving TD
      const stats: PlayerStatBag = {
        rec: 12,
        rec_yd: 102,
        rec_td: 1,
      };

      const result = calculatePlayerPoints(stats, "RB", rules);

      // Expected breakdown:
      // - Receptions: 12 × 1 = 12 (full PPR)
      // - 9+ catches bonus: 2 (threshold bonus)
      // - Receiving yards: 102 × 0.1 = 10.2
      // - Receiving TD: 1 × 6 = 6
      // Total: 12 + 2 + 10.2 + 6 = 30.2
      assert.equal(result, 30.2);
    });

    it("calculates correct total for complete RB performance", () => {
      const rules = getDefaultScoringRuleDefinitions("full_ppr");

      // Complete RB stat line:
      // Rushing: 22 carries, 115 yards, 1 TD
      // Receiving: 5 catches, 40 yards
      // Misc: 1 fumble lost
      const stats: PlayerStatBag = {
        rush_att: 22,
        rush_yd: 115,
        rush_td: 1,
        rec: 5,
        rec_yd: 40,
        fum_lost: 1,
      };

      const result = calculatePlayerPoints(stats, "RB", rules);

      // Expected breakdown:
      // - Rushing yards: 115 × 0.1 = 11.5
      // - Rushing TD: 1 × 6 = 6
      // - Receptions: 5 × 1 = 5 (full PPR)
      // - Receiving yards: 40 × 0.1 = 4
      // - Fumble lost: 1 × -1 = -1
      // Total: 11.5 + 6 + 5 + 4 - 1 = 25.5
      assert.equal(result, 25.5);
    });
  });

  describe("IDP vs team DEF scoping", () => {
    it("scores IDP tackle rules for LB but not team DEF", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "idp-solo",
          category: "defense",
          kind: "simple",
          points: 1,
          stat: "Solo Tackles",
          positions: ["LB" as ScoringPosition],
        },
        {
          id: "team-shutout",
          category: "defense",
          kind: "exact",
          points: 10,
          stat: "Points Allowed",
          exactValue: 0,
          positions: ["DEF" as ScoringPosition],
        },
      ];

      assert.equal(
        calculatePlayerPoints({ tkl_solo: 5 }, "LB", rules),
        5,
      );
      assert.equal(
        calculatePlayerPoints({ tkl_solo: 5, pts_allow_0: 1 }, "DEF", rules),
        10,
      );
    });
  });

  describe("rounding", () => {
    it("rounds to 2 decimal places", () => {
      const rules: ScoringRuleDefinition[] = [
        {
          id: "rush-yds",
          category: "rushing",
          kind: "per_unit",
          points: 1,
          stat: "Rushing Yards",
          every: 10,
          rate: 0.1,
          positions: ["RB" as ScoringPosition],
        },
      ];
      const stats: PlayerStatBag = {
        rush_yd: 123,
      };
      const result = calculatePlayerPoints(stats, "RB", rules);
      // 123 * 0.1 = 12.3
      assert.equal(result, 12.3);
    });
  });
});
