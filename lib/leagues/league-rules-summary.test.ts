import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildStandardRosterSlots } from "@/lib/leagues/defaults";
import { buildLeagueRulesSummary } from "@/lib/leagues/league-rules-summary";

describe("buildLeagueRulesSummary", () => {
  it("includes core league settings sections", () => {
    const sections = buildLeagueRulesSummary({
      season: {
        playoffTeamCount: 6,
        championshipWeek: 17,
        regularSeasonEndWeek: 14,
        rosterMode: "standard",
        benchSlots: 6,
        irEnabled: true,
        irSlots: 1,
        taxiEnabled: false,
        taxiSlots: 0,
        waiversEnabled: true,
        waiverType: "priority",
        faabBudget: null,
        tradesEnabled: true,
        tradeProcessing: "review_24h",
        tradeDeadlineWeek: 11,
        draftType: "live",
        draftStartAt: new Date("2026-07-10T11:13:00.000Z"),
        pickTimeLimitSeconds: 60,
        settings: {
          rosterSlots: buildStandardRosterSlots(6, 1, 0),
          lineupLockMode: "individual",
          waiverWire: {
            allowZeroBids: true,
            waiverPool: "drops_and_free_agents",
            dropWaiverHours: 24,
            churnPrevention: "return_to_fa",
            fcfsMode: "after_process",
            processDays: ["wed"],
            resetOrderWeekly: true,
          },
          transactionRules: {
            permitTradesAfterSeason: false,
            addDropDeadlineWeek: null,
            permitAddDropsAfterSeason: false,
            enforceRosterMinimums: false,
            preseasonFreeAgents: "unlocked",
            preventCutsAfterGameStart: true,
            allowVetoes: true,
            transactionLimits: "unlimited",
          },
          draft: {
            style: "snake",
            autoPickEnabled: false,
            pickTimeLimitEnabled: true,
          },
          schedule: { playEachOtherTimes: 1 },
          playoffs: {
            enabled: true,
            reSeedAfterEachRound: true,
            twoWeekChampionship: false,
          },
          tiebreakers: {
            gameTiebreakers: [
              "offensive_special_tds",
              "highest_starter",
              "bench_points",
            ],
            breakRegularSeasonTies: false,
            rankTiebreakers: [
              "head_to_head",
              "points_per_game",
              "schedule_record",
              "schedule_points",
            ],
            applyOfficialStatChanges: true,
          },
        },
      },
    });

    const byTitle = Object.fromEntries(
      sections.map((section) => [section.title, section.rows]),
    );

    assert.deepEqual(
      sections.map((section) => section.title),
      [
        "Rosters",
        "Schedule",
        "Playoffs",
        "Waiver Claims",
        "Transaction Rules",
        "Draft",
        "Tiebreakers",
      ],
    );

    assert.equal(
      byTitle.Rosters.find((row) => row.label === "Roster Requirements")
        ?.value,
      "1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, 1 K, 1 DEF",
    );
    assert.equal(
      byTitle["Waiver Claims"].find(
        (row) => row.label === "How Are Claims Resolved",
      )?.value,
      "Waiver Priority",
    );
    assert.equal(
      byTitle["Transaction Rules"].find((row) => row.label === "Trade Deadline")
        ?.value,
      "Week 11",
    );
    assert.equal(
      byTitle.Draft.find((row) => row.label === "Draft Style")?.value,
      "Snake",
    );
    assert.match(
      byTitle.Tiebreakers.find(
        (row) => row.label === "Individual Game Tiebreakers",
      )?.value ?? "",
      /^1\. Most total starter/,
    );
  });

  it("shows waivers off when disabled", () => {
    const sections = buildLeagueRulesSummary({
      season: {
        playoffTeamCount: 4,
        championshipWeek: 17,
        regularSeasonEndWeek: 15,
        rosterMode: "standard",
        benchSlots: 6,
        irEnabled: false,
        irSlots: 0,
        taxiEnabled: false,
        taxiSlots: 0,
        waiversEnabled: false,
        waiverType: "priority",
        faabBudget: null,
        tradesEnabled: false,
        tradeProcessing: "instant",
        tradeDeadlineWeek: null,
        draftType: "email",
        draftStartAt: new Date("2026-08-01T12:00:00.000Z"),
        pickTimeLimitSeconds: 3600,
        settings: {
          rosterSlots: buildStandardRosterSlots(6, 0, 0),
          playoffs: {
            enabled: false,
            reSeedAfterEachRound: true,
            twoWeekChampionship: false,
          },
          draft: {
            style: "linear",
            autoPickEnabled: true,
            pickTimeLimitEnabled: false,
          },
        },
      },
    });

    const waivers = sections.find((section) => section.title === "Waiver Claims");
    const playoffs = sections.find((section) => section.title === "Playoffs");
    const draft = sections.find((section) => section.title === "Draft");

    assert.equal(waivers?.rows[0]?.value, "Off");
    assert.equal(playoffs?.rows[0]?.value, "Disabled");
    assert.equal(
      draft?.rows.find((row) => row.label === "Time Per Pick")?.value,
      "Unlimited",
    );
  });
});
