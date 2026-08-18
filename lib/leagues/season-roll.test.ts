import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assignReverseFinishDraftSlots,
  canStartNewDynastySeason,
  mintDraftPickAssetSpecs,
  mintDraftPickYears,
  nextSeasonDraftStartAt,
  settingsForRolledDynastySeason,
} from "@/lib/leagues/season-roll";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { defaultDynastySettings } from "@/lib/leagues/dynasty-settings";

describe("mintDraftPickYears", () => {
  it("includes the upcoming year plus N future years", () => {
    assert.deepEqual(mintDraftPickYears(2027, 3), [2027, 2028, 2029, 2030]);
  });

  it("falls back to one future year when the setting is invalid", () => {
    assert.deepEqual(mintDraftPickYears(2026, 0), [2026, 2027]);
  });
});

describe("mintDraftPickAssetSpecs", () => {
  it("mints every team/year/round and skips when rounds are 0", () => {
    assert.deepEqual(
      mintDraftPickAssetSpecs({
        teamIds: ["a", "b"],
        years: [2027],
        rounds: 2,
      }),
      [
        {
          draftYear: 2027,
          round: 1,
          originalTeamId: "a",
          ownerTeamId: "a",
        },
        {
          draftYear: 2027,
          round: 2,
          originalTeamId: "a",
          ownerTeamId: "a",
        },
        {
          draftYear: 2027,
          round: 1,
          originalTeamId: "b",
          ownerTeamId: "b",
        },
        {
          draftYear: 2027,
          round: 2,
          originalTeamId: "b",
          ownerTeamId: "b",
        },
      ],
    );
    assert.deepEqual(
      mintDraftPickAssetSpecs({
        teamIds: ["a"],
        years: [2027],
        rounds: 0,
      }),
      [],
    );
  });
});

describe("assignReverseFinishDraftSlots", () => {
  it("gives 1st place the last pick and unranked teams the first picks", () => {
    assert.deepEqual(
      assignReverseFinishDraftSlots([
        { teamId: "best", rank: 1 },
        { teamId: "mid", rank: 2 },
        { teamId: "worst", rank: 3 },
        { teamId: "open-b", rank: null },
        { teamId: "open-a", rank: null },
      ]),
      [
        { teamId: "open-a", draftSlot: 1 },
        { teamId: "open-b", draftSlot: 2 },
        { teamId: "worst", draftSlot: 3 },
        { teamId: "mid", draftSlot: 4 },
        { teamId: "best", draftSlot: 5 },
      ],
    );
  });
});

describe("canStartNewDynastySeason", () => {
  const base = {
    leagueType: "dynasty",
    seasonStatus: "active",
    nextSeasonExists: false,
    playoffsEnabled: true,
    championTeamId: "champ",
    regularSeasonFinished: false,
  };

  it("requires a champion when playoffs are on", () => {
    assert.equal(canStartNewDynastySeason(base), true);
    assert.equal(
      canStartNewDynastySeason({ ...base, championTeamId: null }),
      false,
    );
  });

  it("requires the regular season to be over when playoffs are off", () => {
    assert.equal(
      canStartNewDynastySeason({
        ...base,
        playoffsEnabled: false,
        championTeamId: null,
        regularSeasonFinished: true,
      }),
      true,
    );
    assert.equal(
      canStartNewDynastySeason({
        ...base,
        playoffsEnabled: false,
        championTeamId: null,
        regularSeasonFinished: false,
      }),
      false,
    );
  });

  it("hides once the next year exists or the league is redraft", () => {
    assert.equal(
      canStartNewDynastySeason({ ...base, nextSeasonExists: true }),
      false,
    );
    assert.equal(
      canStartNewDynastySeason({ ...base, leagueType: "redraft" }),
      false,
    );
    assert.equal(
      canStartNewDynastySeason({ ...base, seasonStatus: "recruiting" }),
      false,
    );
  });
});

describe("nextSeasonDraftStartAt", () => {
  it("adds a year when that instant is still in the future", () => {
    const previous = new Date("2026-08-20T18:00:00.000Z");
    const now = new Date("2026-12-01T00:00:00.000Z");
    assert.equal(
      nextSeasonDraftStartAt(previous, now).toISOString(),
      "2027-08-20T18:00:00.000Z",
    );
  });

  it("falls back two weeks out when the rolled date is already past", () => {
    const previous = new Date("2025-08-20T18:00:00.000Z");
    const now = new Date("2027-01-01T00:00:00.000Z");
    assert.equal(
      nextSeasonDraftStartAt(previous, now).toISOString(),
      "2027-01-15T00:00:00.000Z",
    );
  });
});

describe("settingsForRolledDynastySeason", () => {
  it("clears startup/lock flags and sets spare draft rounds", () => {
    const settings: LeagueSeasonSettings = {
      rosterSlots: [
        {
          positionId: "QB",
          slotCount: 1,
          minSlots: 1,
          maxSlots: 1,
          isStarter: true,
        },
        {
          positionId: "BN",
          slotCount: 4,
          minSlots: 0,
          maxSlots: 4,
          isStarter: false,
        },
      ],
      dynasty: {
        ...defaultDynastySettings(),
        keepersMax: 3,
        keepersLocked: true,
        isStartupSeason: true,
      },
      draft: { style: "snake", autoPickEnabled: true, rounds: 5 },
    };

    const next = settingsForRolledDynastySeason(settings, 4);
    assert.equal(next.dynasty?.isStartupSeason, false);
    assert.equal(next.dynasty?.keepersLocked, false);
    assert.equal(next.draft?.rounds, 2);
  });
});
