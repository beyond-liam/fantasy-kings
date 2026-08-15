import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { possessionRing } from "./possession-ring";

describe("possessionRing", () => {
  it("is off when the game is not live", () => {
    assert.equal(
      possessionRing({
        primaryPositionId: "WR",
        hasPossession: true,
        inRedZone: true,
        isLive: false,
      }),
      null,
    );
  });

  it("rings offense green when they have the ball", () => {
    const ring = possessionRing({
      primaryPositionId: "WR",
      hasPossession: true,
      inRedZone: false,
      isLive: true,
    });
    assert.ok(ring?.className.includes("border-success"));
    assert.equal(ring?.label, "has possession");
  });

  it("rings offense red in the red zone", () => {
    const ring = possessionRing({
      primaryPositionId: "RB",
      hasPossession: true,
      inRedZone: true,
      isLive: true,
    });
    assert.ok(ring?.className.includes("border-destructive"));
    assert.equal(ring?.label, "in the red zone");
  });

  it("does not ring offense without the ball", () => {
    assert.equal(
      possessionRing({
        primaryPositionId: "QB",
        hasPossession: false,
        inRedZone: true,
        isLive: true,
      }),
      null,
    );
  });

  it("rings defense green when they do not have the ball", () => {
    const ring = possessionRing({
      primaryPositionId: "DEF",
      hasPossession: false,
      inRedZone: false,
      isLive: true,
    });
    assert.ok(ring?.className.includes("border-success"));
    assert.equal(ring?.label, "defense on the field");
  });

  it("rings defense red when defending the red zone", () => {
    const ring = possessionRing({
      primaryPositionId: "LB",
      hasPossession: false,
      inRedZone: true,
      isLive: true,
    });
    assert.ok(ring?.className.includes("border-destructive"));
    assert.equal(ring?.label, "in the red zone");
  });

  it("does not ring defense when the offense has the ball", () => {
    assert.equal(
      possessionRing({
        primaryPositionId: "DEF",
        hasPossession: true,
        inRedZone: false,
        isLive: true,
      }),
      null,
    );
  });
});
