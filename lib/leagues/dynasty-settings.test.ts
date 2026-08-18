import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampDynastyKeepersToRosterCap,
  countKeepersTowardMax,
  defaultDynastySettings,
  dynastySettingsSchema,
  isKeeperDeadlineDue,
  keepersMaxDescription,
  maxConfigurableDynastyDraftRounds,
  maxCountingKeepersCap,
  maxDynastyDraftRounds,
  mergeDynastyFormWithStored,
  resolveDynastySettings,
  validateKeeperSelection,
} from "@/lib/leagues/dynasty-settings";

describe("defaultDynastySettings", () => {
  it("leaves keepers max unset", () => {
    assert.equal(defaultDynastySettings().keepersMax, null);
  });
});

describe("maxCountingKeepersCap", () => {
  const roster = { activeRosterSize: 15, irSlots: 2, taxiSlots: 3 };

  it("uses active roster when IR and Taxi do not count", () => {
    assert.equal(
      maxCountingKeepersCap(roster, {
        irCountsTowardKeepers: false,
        taxiCountsTowardKeepers: false,
      }),
      15,
    );
  });

  it("adds IR and Taxi slots when their toggles are on", () => {
    assert.equal(
      maxCountingKeepersCap(roster, {
        irCountsTowardKeepers: true,
        taxiCountsTowardKeepers: true,
      }),
      20,
    );
  });
});

describe("clampDynastyKeepersToRosterCap", () => {
  it("clamps keepersMax when it exceeds the counting cap", () => {
    const clamped = clampDynastyKeepersToRosterCap(
      {
        keepersMax: 99,
        keepersMin: 40,
        keeperDeadlineAt: null,
        irCountsTowardKeepers: false,
        taxiCountsTowardKeepers: false,
        futurePickTradeYears: 3,
        draftPlayerPool: "rookies",
        keepersLocked: false,
      },
      { activeRosterSize: 15, irSlots: 2, taxiSlots: 3 },
    );
    assert.equal(clamped.keepersMax, 15);
    assert.equal(clamped.keepersMin, 15);
  });

  it("keeps keepersMax null when unset", () => {
    const clamped = clampDynastyKeepersToRosterCap(
      {
        keepersMax: null,
        keepersMin: null,
        keeperDeadlineAt: null,
        irCountsTowardKeepers: false,
        taxiCountsTowardKeepers: false,
        futurePickTradeYears: 3,
        draftPlayerPool: "rookies",
        keepersLocked: false,
      },
      { activeRosterSize: 15, irSlots: 2, taxiSlots: 3 },
    );
    assert.equal(clamped.keepersMax, null);
  });
});

describe("keepersMaxDescription", () => {
  it("includes the computed cap", () => {
    const text = keepersMaxDescription(
      { activeRosterSize: 15, irSlots: 2, taxiSlots: 0 },
      { irCountsTowardKeepers: true, taxiCountsTowardKeepers: false },
    );
    assert.match(text, /Cap is 17/);
    assert.match(text, /starters \+ bench \+ IR/);
  });
});

describe("maxDynastyDraftRounds", () => {
  it("is rosterCap minus keepersMax", () => {
    assert.equal(maxDynastyDraftRounds(25, 20), 5);
    assert.equal(maxDynastyDraftRounds(15, 15), 0);
    assert.equal(maxDynastyDraftRounds(10, 12), 0);
  });
});

describe("maxConfigurableDynastyDraftRounds", () => {
  it("uses full roster cap for startup drafts", () => {
    assert.equal(
      maxConfigurableDynastyDraftRounds({
        rosterCap: 25,
        keepersMax: 20,
        isStartup: true,
      }),
      25,
    );
  });

  it("uses spare spots after keepers for later seasons", () => {
    assert.equal(
      maxConfigurableDynastyDraftRounds({
        rosterCap: 25,
        keepersMax: 20,
        isStartup: false,
      }),
      5,
    );
  });
});

describe("resolveDynastySettings", () => {
  it("fills defaults for missing fields", () => {
    const resolved = resolveDynastySettings({ keepersMax: 18 });
    assert.equal(resolved.keepersMax, 18);
    assert.equal(resolved.keepersMin, null);
    assert.equal(resolved.irCountsTowardKeepers, false);
    assert.equal(resolved.draftPlayerPool, "rookies");
    assert.equal(resolved.futurePickTradeYears, 3);
    assert.equal(resolved.keepersLocked, false);
    assert.equal(resolved.isStartupSeason, true);
  });

  it("preserves unset keepers max", () => {
    assert.equal(resolveDynastySettings(null).keepersMax, null);
    assert.equal(resolveDynastySettings({}).keepersMax, null);
  });

  it("clamps keepersMin to keepersMax", () => {
    const resolved = resolveDynastySettings({
      keepersMax: 5,
      keepersMin: 9,
    });
    assert.equal(resolved.keepersMin, 5);
  });
});

describe("dynastySettingsSchema", () => {
  it("accepts valid settings", () => {
    const parsed = dynastySettingsSchema.parse({
      keepersMax: 20,
      keepersMin: null,
      keeperDeadlineAt: null,
      irCountsTowardKeepers: false,
      taxiCountsTowardKeepers: true,
      futurePickTradeYears: 3,
      draftPlayerPool: "all",
    });
    assert.equal(parsed.draftPlayerPool, "all");
  });

  it("accepts null keepers max", () => {
    const parsed = dynastySettingsSchema.parse({
      keepersMax: null,
      keepersMin: null,
      keeperDeadlineAt: null,
      irCountsTowardKeepers: false,
      taxiCountsTowardKeepers: false,
      futurePickTradeYears: 3,
      draftPlayerPool: "rookies",
    });
    assert.equal(parsed.keepersMax, null);
  });

  it("rejects keepersMin above keepersMax", () => {
    const result = dynastySettingsSchema.safeParse({
      keepersMax: 5,
      keepersMin: 6,
      keeperDeadlineAt: null,
      irCountsTowardKeepers: false,
      taxiCountsTowardKeepers: false,
      futurePickTradeYears: 3,
      draftPlayerPool: "rookies",
    });
    assert.equal(result.success, false);
  });
});

describe("countKeepersTowardMax", () => {
  const keepers = [
    { slotPositionId: "QB" },
    { slotPositionId: "BN" },
    { slotPositionId: "IR" },
    { slotPositionId: "TAXI" },
  ];

  it("ignores IR and Taxi when toggles are off", () => {
    assert.equal(
      countKeepersTowardMax(keepers, {
        irCountsTowardKeepers: false,
        taxiCountsTowardKeepers: false,
      }),
      2,
    );
  });

  it("counts IR and Taxi when toggles are on", () => {
    assert.equal(
      countKeepersTowardMax(keepers, {
        irCountsTowardKeepers: true,
        taxiCountsTowardKeepers: true,
      }),
      4,
    );
  });
});

describe("validateKeeperSelection", () => {
  const base = {
    keepersMax: 2,
    keepersMin: null,
    keeperDeadlineAt: null,
    irCountsTowardKeepers: false,
    taxiCountsTowardKeepers: false,
    futurePickTradeYears: 3,
    draftPlayerPool: "rookies" as const,
    keepersLocked: false,
    isStartupSeason: true,
  };

  it("rejects when keepers max is unset", () => {
    const result = validateKeeperSelection([{ slotPositionId: "QB" }], {
      ...base,
      keepersMax: null,
    });
    assert.equal(result.ok, false);
  });

  it("rejects when over max counting keepers", () => {
    const result = validateKeeperSelection(
      [{ slotPositionId: "QB" }, { slotPositionId: "RB" }, { slotPositionId: "WR" }],
      base,
    );
    assert.equal(result.ok, false);
  });

  it("ignores non-counting IR toward max", () => {
    const result = validateKeeperSelection(
      [
        { slotPositionId: "QB" },
        { slotPositionId: "RB" },
        { slotPositionId: "IR" },
      ],
      base,
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.counting, 2);
  });

  it("enforces optional keepers min", () => {
    const result = validateKeeperSelection([{ slotPositionId: "QB" }], {
      ...base,
      keepersMin: 2,
    });
    assert.equal(result.ok, false);
  });
});

describe("keepersLocked", () => {
  it("defaults to unlocked", () => {
    assert.equal(defaultDynastySettings().keepersLocked, false);
    assert.equal(resolveDynastySettings({ keepersMax: 12 }).keepersLocked, false);
  });

  it("preserves lock when merging form values", () => {
    const stored = resolveDynastySettings({
      keepersMax: 12,
      keepersLocked: true,
      isStartupSeason: false,
    });
    const merged = mergeDynastyFormWithStored(
      {
        keepersMax: 10,
        keepersMin: null,
        keeperDeadlineAt: null,
        irCountsTowardKeepers: false,
        taxiCountsTowardKeepers: false,
        futurePickTradeYears: 3,
        draftPlayerPool: "rookies",
      },
      stored,
    );
    assert.equal(merged.keepersMax, 10);
    assert.equal(merged.keepersLocked, true);
    assert.equal(merged.isStartupSeason, false);
  });
});

describe("isKeeperDeadlineDue", () => {
  const base = resolveDynastySettings({ keepersMax: 12 });

  it("is false when no deadline is set", () => {
    assert.equal(isKeeperDeadlineDue(base, new Date("2026-08-18T18:00:00Z")), false);
  });

  it("is false before the stored instant", () => {
    assert.equal(
      isKeeperDeadlineDue(
        { ...base, keeperDeadlineAt: "2026-08-18T18:00:00.000Z" },
        new Date("2026-08-18T17:59:59.000Z"),
      ),
      false,
    );
  });

  it("is true at or after the stored instant", () => {
    assert.equal(
      isKeeperDeadlineDue(
        { ...base, keeperDeadlineAt: "2026-08-18T18:00:00.000Z" },
        new Date("2026-08-18T18:00:00.000Z"),
      ),
      true,
    );
  });

  it("is false when keepers are already locked", () => {
    assert.equal(
      isKeeperDeadlineDue(
        {
          ...base,
          keeperDeadlineAt: "2026-08-18T18:00:00.000Z",
          keepersLocked: true,
        },
        new Date("2026-08-18T19:00:00.000Z"),
      ),
      false,
    );
  });
});
