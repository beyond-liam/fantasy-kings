import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildWinProbabilityChartData } from "@/components/scores/game/win-probability-chart";

describe("buildWinProbabilityChartData", () => {
  it("splits values onto away and home lead series", () => {
    const rows = buildWinProbabilityChartData([
      { awayPct: 60 },
      { awayPct: 40 },
    ]);

    assert.equal(rows[0]?.awayLead, 60);
    assert.equal(rows[0]?.homeLead, null);
    assert.equal(rows.at(-1)?.awayLead, null);
    assert.equal(rows.at(-1)?.homeLead, 40);
  });

  it("inserts a midpoint crossing when the line crosses 50%", () => {
    const rows = buildWinProbabilityChartData([
      { awayPct: 70 },
      { awayPct: 30 },
    ]);

    const crossing = rows.find((row) => row.awayPct === 50);
    assert.ok(crossing);
    assert.equal(crossing?.awayLead, 50);
    assert.equal(crossing?.homeLead, 50);
    assert.ok((crossing?.index ?? 0) > 0 && (crossing?.index ?? 0) < 1);
  });
});
