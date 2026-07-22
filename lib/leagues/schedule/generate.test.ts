import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRoundRobinRounds,
  generateRegularSeasonSchedule,
  pairKey,
} from "./generate";

describe("buildRoundRobinRounds", () => {
  it("gives every pair exactly once for even team counts", () => {
    const teams = ["a", "b", "c", "d"];
    const rounds = buildRoundRobinRounds(teams);
    assert.equal(rounds.length, 3);

    const seen = new Set<string>();
    for (const round of rounds) {
      assert.equal(round.length, 2);
      for (const [home, away] of round) {
        const key = pairKey(home, away);
        assert.equal(seen.has(key), false, `duplicate ${key}`);
        seen.add(key);
      }
    }
    assert.equal(seen.size, 6);
  });

  it("handles odd team counts with byes", () => {
    const teams = ["a", "b", "c"];
    const rounds = buildRoundRobinRounds(teams);
    assert.equal(rounds.length, 3);

    const seen = new Set<string>();
    for (const round of rounds) {
      assert.equal(round.length, 1);
      for (const [home, away] of round) {
        seen.add(pairKey(home, away));
      }
    }
    assert.equal(seen.size, 3);
  });
});

describe("generateRegularSeasonSchedule", () => {
  it("does not rematch before the first round robin is complete", () => {
    const teams = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
    const schedule = generateRegularSeasonSchedule({
      teamIds: teams,
      weekCount: 14,
      playEachOtherTimes: 1,
    });

    const pairCounts = new Map<string, number>();
    const weekPairs = new Map<number, string[]>();

    for (const m of schedule) {
      const key = pairKey(m.homeTeamId, m.awayTeamId);
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      const list = weekPairs.get(m.week) ?? [];
      list.push(key);
      weekPairs.set(m.week, list);
    }

    // First 7 weeks (8-1) = one full RR: every pair appears exactly once.
    const firstCyclePairs = new Set<string>();
    for (let week = 1; week <= 7; week++) {
      for (const key of weekPairs.get(week) ?? []) {
        assert.equal(
          firstCyclePairs.has(key),
          false,
          `rematch in first cycle: ${key}`,
        );
        firstCyclePairs.add(key);
      }
    }
    assert.equal(firstCyclePairs.size, 28);

    // Rematches only appear after week 7.
    for (const [key, count] of pairCounts) {
      if (count > 1) {
        let firstWeek = Infinity;
        let secondWeek = Infinity;
        for (const m of schedule) {
          if (pairKey(m.homeTeamId, m.awayTeamId) !== key) {
            continue;
          }
          if (m.week < firstWeek) {
            secondWeek = firstWeek;
            firstWeek = m.week;
          } else if (m.week < secondWeek) {
            secondWeek = m.week;
          }
        }
        assert.ok(firstWeek <= 7);
        assert.ok(secondWeek > 7);
      }
    }
  });

  it("fills every requested week for a full 12-team league", () => {
    const teams = Array.from({ length: 12 }, (_, i) => `t${i + 1}`);
    const schedule = generateRegularSeasonSchedule({
      teamIds: teams,
      weekCount: 14,
      playEachOtherTimes: 1,
    });

    const weeks = new Set(schedule.map((m) => m.week));
    assert.equal(weeks.size, 14);
    for (let week = 1; week <= 14; week++) {
      const games = schedule.filter((m) => m.week === week);
      assert.equal(games.length, 6);
    }
  });
});
