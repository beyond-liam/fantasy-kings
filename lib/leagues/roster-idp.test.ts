import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectRosterUiMode,
  getDefaultIdpCustomRosterSlots,
  isIdpRosterPreset,
} from "@/lib/leagues/roster";

describe("IDP roster preset", () => {
  it("builds standard starters plus 2CB/2S/1DT/2DE/2LB", () => {
    const slots = getDefaultIdpCustomRosterSlots();
    assert.equal(isIdpRosterPreset(slots), true);
    assert.equal(
      detectRosterUiMode({ rosterMode: "custom", customRosterSlots: slots }),
      "idp",
    );
    const counts = Object.fromEntries(
      slots
        .filter((slot) => slot.isStarter)
        .map((slot) => [slot.positionId, slot.slotCount]),
    );
    assert.deepEqual(
      {
        CB: counts.CB,
        S: counts.S,
        DT: counts.DT,
        DE: counts.DE,
        LB: counts.LB,
      },
      { CB: 2, S: 2, DT: 1, DE: 2, LB: 2 },
    );
  });

  it("rejects tweaked presets as custom", () => {
    const slots = getDefaultIdpCustomRosterSlots().map((slot) =>
      slot.positionId === "LB"
        ? { ...slot, slotCount: 3, minSlots: 3, maxSlots: 3 }
        : slot,
    );
    assert.equal(isIdpRosterPreset(slots), false);
    assert.equal(
      detectRosterUiMode({ rosterMode: "custom", customRosterSlots: slots }),
      "custom",
    );
  });
});
