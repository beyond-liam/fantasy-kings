import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTeamH2hSeries, lastFinalMeetings } from "@/lib/leagues/team-h2h";
import type { TeamScheduleRow } from "@/lib/queries/matchups";

function meeting(
  week: number,
  opts: {
    isHome: boolean;
    homePts: number;
    awayPts: number;
    status?: TeamScheduleRow["status"];
  },
): TeamScheduleRow {
  return {
    id: `m${week}`,
    publicId: `p${week}`,
    week,
    opponentTeamId: "them",
    opponentName: "Them",
    opponentSlug: "them",
    opponentLogoUrl: null,
    isHome: opts.isHome,
    status: opts.status ?? "final",
    homePts: opts.homePts,
    awayPts: opts.awayPts,
  };
}

describe("buildTeamH2hSeries", () => {
  it("aggregates record, streak, averages, and extremes from the viewer schedule", () => {
    const series = buildTeamH2hSeries(
      [
        meeting(1, { isHome: true, homePts: 120, awayPts: 100 }),
        meeting(5, { isHome: false, homePts: 110, awayPts: 90 }),
        meeting(8, { isHome: true, homePts: 95, awayPts: 95 }),
        meeting(12, { isHome: true, homePts: 80, awayPts: 130 }),
      ],
      "them",
      2025,
    );
    assert.equal(series.recordLabel, "1-2-1");
    assert.equal(series.wins, 1);
    assert.equal(series.losses, 2);
    assert.equal(series.ties, 1);
    assert.equal(series.bestWin?.week, 1);
    assert.equal(series.worstLoss?.week, 12);
    assert.equal(series.biggestBlowout?.week, 12);
    assert.equal(series.closestGame?.week, 8);
    assert.equal(series.streak, "L1");
    assert.equal(series.longestWinStreak, 1);
    assert.equal(series.longestLossStreak, 1);
    assert.equal(series.avgPf, 96.3);
    assert.equal(series.avgMargin, -12.5);
    assert.equal(series.meetings.length, 4);
    assert.equal(series.meetings[0]?.seasonYear, 2025);
  });

  it("tracks longest win and loss streaks across the series", () => {
    const series = buildTeamH2hSeries(
      [
        meeting(1, { isHome: true, homePts: 110, awayPts: 100 }),
        meeting(2, { isHome: true, homePts: 120, awayPts: 100 }),
        meeting(3, { isHome: true, homePts: 130, awayPts: 100 }),
        meeting(4, { isHome: true, homePts: 80, awayPts: 100 }),
        meeting(5, { isHome: true, homePts: 70, awayPts: 100 }),
      ],
      "them",
      2025,
    );
    assert.equal(series.streak, "L2");
    assert.equal(series.longestWinStreak, 3);
    assert.equal(series.longestLossStreak, 2);
  });

  it("ignores other opponents", () => {
    const series = buildTeamH2hSeries(
      [
        {
          ...meeting(1, { isHome: true, homePts: 100, awayPts: 90 }),
          opponentTeamId: "other",
        },
      ],
      "them",
      2025,
    );
    assert.equal(series.meetings.length, 0);
    assert.equal(series.recordLabel, "0-0");
    assert.equal(series.avgPf, null);
  });

  it("returns the last finalized meetings newest first", () => {
    const series = buildTeamH2hSeries(
      [
        meeting(1, { isHome: true, homePts: 100, awayPts: 90 }),
        meeting(2, { isHome: true, homePts: 80, awayPts: 90 }),
        meeting(3, {
          isHome: true,
          homePts: 0,
          awayPts: 0,
          status: "scheduled",
        }),
      ],
      "them",
      2025,
    );
    const last = lastFinalMeetings(series, 5);
    assert.deepEqual(
      last.map((row) => row.week),
      [2, 1],
    );
  });
});
