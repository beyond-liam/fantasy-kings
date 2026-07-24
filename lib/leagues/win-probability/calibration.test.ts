import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  POSITION_SIGMA,
  positionSigma,
  rmseByPosition,
} from "@/lib/leagues/win-probability/calibration";

describe("win-prob calibration", () => {
  it("resolves calibrated position σ", () => {
    assert.equal(positionSigma("qb"), POSITION_SIGMA.QB);
    assert.equal(positionSigma("RB"), POSITION_SIGMA.RB);
    assert.ok(positionSigma("UNK") > 0);
  });

  it("computes RMSE by position from residuals", () => {
    const result = rmseByPosition([
      { primaryPositionId: "RB", projectedPts: 10, actualPts: 12 },
      { primaryPositionId: "RB", projectedPts: 10, actualPts: 8 },
      { primaryPositionId: "QB", projectedPts: 20, actualPts: 20 },
    ]);
    assert.equal(result.RB?.n, 2);
    assert.equal(result.RB?.rmse, 2);
    assert.equal(result.QB?.rmse, 0);
  });
});
