import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapSleeperDepthChartToPrimary,
  mapSleeperNflPositionToPrimary,
  resolveIdpPrimaryPosition,
} from "@/lib/leagues/idp-positions";
import { resolveSleeperPrimaryPosition } from "@/lib/players/resolve-sleeper-position";

describe("mapSleeperNflPositionToPrimary", () => {
  it("maps DE/DT/LB/CB/S and common variants", () => {
    assert.equal(mapSleeperNflPositionToPrimary("DE"), "DE");
    assert.equal(mapSleeperNflPositionToPrimary("DT"), "DT");
    assert.equal(mapSleeperNflPositionToPrimary("NT"), "DT");
    assert.equal(mapSleeperNflPositionToPrimary("LB"), "LB");
    assert.equal(mapSleeperNflPositionToPrimary("OLB"), "LB");
    assert.equal(mapSleeperNflPositionToPrimary("ILB"), "LB");
    assert.equal(mapSleeperNflPositionToPrimary("CB"), "CB");
    assert.equal(mapSleeperNflPositionToPrimary("FS"), "S");
    assert.equal(mapSleeperNflPositionToPrimary("SS"), "S");
  });

  it("ignores fantasy buckets and unknown labels", () => {
    assert.equal(mapSleeperNflPositionToPrimary("DL"), null);
    assert.equal(mapSleeperNflPositionToPrimary("DB"), null);
    assert.equal(mapSleeperNflPositionToPrimary("EDGE"), null);
    assert.equal(mapSleeperNflPositionToPrimary("EDR"), null);
  });
});

describe("mapSleeperDepthChartToPrimary", () => {
  it("splits DB/DL depth labels into CB/S/DE/DT/LB", () => {
    assert.equal(mapSleeperDepthChartToPrimary("RCB"), "CB");
    assert.equal(mapSleeperDepthChartToPrimary("NB"), "CB");
    assert.equal(mapSleeperDepthChartToPrimary("FS"), "S");
    assert.equal(mapSleeperDepthChartToPrimary("SS"), "S");
    assert.equal(mapSleeperDepthChartToPrimary("LDE"), "DE");
    assert.equal(mapSleeperDepthChartToPrimary("NT"), "DT");
    assert.equal(mapSleeperDepthChartToPrimary("MLB"), "LB");
    assert.equal(mapSleeperDepthChartToPrimary("DB"), null);
    assert.equal(mapSleeperDepthChartToPrimary("DL"), null);
  });
});

describe("resolveIdpPrimaryPosition", () => {
  it("prefers NFL position then depth chart for DL/DB", () => {
    assert.equal(resolveIdpPrimaryPosition("CB", "FS"), "CB");
    assert.equal(resolveIdpPrimaryPosition("DB", "RCB"), "CB");
    assert.equal(resolveIdpPrimaryPosition("DB", "FS"), "S");
    assert.equal(resolveIdpPrimaryPosition("DL", "RDE"), "DE");
    assert.equal(resolveIdpPrimaryPosition("DB", "DB"), null);
  });
});

describe("resolveSleeperPrimaryPosition", () => {
  const base = {
    active: true,
    hasDisplayName: true,
    team: "KC",
    fantasy_positions: null as string[] | null,
  };

  it("keeps team DEF and offense", () => {
    assert.equal(
      resolveSleeperPrimaryPosition({
        ...base,
        position: "DEF",
        fantasy_positions: ["DEF"],
      }),
      "DEF",
    );
    assert.equal(
      resolveSleeperPrimaryPosition({
        ...base,
        position: "WR",
        fantasy_positions: ["WR"],
      }),
      "WR",
    );
  });

  it("imports IDP from NFL position", () => {
    assert.equal(
      resolveSleeperPrimaryPosition({
        ...base,
        position: "CB",
        fantasy_positions: ["DB"],
      }),
      "CB",
    );
    assert.equal(
      resolveSleeperPrimaryPosition({
        ...base,
        position: "DE",
        fantasy_positions: ["DL"],
      }),
      "DE",
    );
  });

  it("imports DB/DL stars via depth chart", () => {
    assert.equal(
      resolveSleeperPrimaryPosition({
        ...base,
        team: "IND",
        position: "DB",
        fantasy_positions: ["DB"],
        depth_chart_position: "RCB",
      }),
      "CB",
    );
    assert.equal(
      resolveSleeperPrimaryPosition({
        ...base,
        team: "LAC",
        position: "DB",
        fantasy_positions: ["DB"],
        depth_chart_position: "NB",
      }),
      "CB",
    );
    assert.equal(
      resolveSleeperPrimaryPosition({
        ...base,
        team: "TB",
        position: "DB",
        fantasy_positions: ["DB"],
        depth_chart_position: "FS",
      }),
      "S",
    );
  });

  it("does not invent IDP from DL/DB alone", () => {
    assert.equal(
      resolveSleeperPrimaryPosition({
        ...base,
        position: "DL",
        fantasy_positions: ["DL"],
      }),
      null,
    );
    assert.equal(
      resolveSleeperPrimaryPosition({
        ...base,
        position: "DB",
        fantasy_positions: ["DB"],
        depth_chart_position: "DB",
      }),
      null,
    );
  });

  it("requires an NFL team", () => {
    assert.equal(
      resolveSleeperPrimaryPosition({
        ...base,
        team: null,
        position: "CB",
        fantasy_positions: ["DB"],
      }),
      null,
    );
  });
});
