import { describe, expect, it } from "vitest";
import { shouldAutoRunNflverse } from "./nflverse-run-gate";
import type { ScheduleGame } from "@/lib/espn/scoreboard";

describe("shouldAutoRunNflverse", () => {
  it("runs when force=true regardless of scoreboard", () => {
    expect(
      shouldAutoRunNflverse({
        force: true,
        scoreboardOk: false,
        games: [],
      }),
    ).toBe(true);

    const liveGames: ScheduleGame[] = [
      {
        id: "1",
        status: "in",
        homeTeam: { abbrev: "SF", score: 10 },
        awayTeam: { abbrev: "KC", score: 7 },
        schedule: { date: "2024-09-08T13:00:00Z" },
      },
    ];
    expect(
      shouldAutoRunNflverse({ force: true, scoreboardOk: true, games: liveGames }),
    ).toBe(true);
  });

  it("skips when games are live (status=in)", () => {
    const liveGames: ScheduleGame[] = [
      {
        id: "1",
        status: "in",
        homeTeam: { abbrev: "SF", score: 10 },
        awayTeam: { abbrev: "KC", score: 7 },
        schedule: { date: "2024-09-08T13:00:00Z" },
      },
    ];
    expect(
      shouldAutoRunNflverse({ force: false, scoreboardOk: true, games: liveGames }),
    ).toBe(false);
  });

  it("runs when all games are post", () => {
    const postGames: ScheduleGame[] = [
      {
        id: "1",
        status: "post",
        homeTeam: { abbrev: "SF", score: 24 },
        awayTeam: { abbrev: "KC", score: 21 },
        schedule: { date: "2024-09-08T13:00:00Z" },
      },
    ];
    expect(
      shouldAutoRunNflverse({ force: false, scoreboardOk: true, games: postGames }),
    ).toBe(true);
  });

  it("runs when games array is empty and scoreboardOk=true", () => {
    expect(
      shouldAutoRunNflverse({ force: false, scoreboardOk: true, games: [] }),
    ).toBe(true);
  });

  it("runs when scoreboardOk=false (current behavior, treats outage as done)", () => {
    expect(
      shouldAutoRunNflverse({ force: false, scoreboardOk: false, games: [] }),
    ).toBe(true);
  });
});
