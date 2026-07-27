import type { OverviewWeeklyRoast } from "@/lib/leagues/league-overview";

/** Design preview for the weekly roast row. Enable with `?mock=1` on league home. */
export function getOverviewWeeklyRoastMock(): OverviewWeeklyRoast {
  return {
    week: 1,
    biggestScorer: {
      teamId: "mock-roast-1",
      teamPublicId: "mock-roast-1",
      teamName: "Northside Knights",
      ownerName: "Alex Rivera",
      logoUrl: null,
      value: 148.6,
    },
    luckiestWinner: {
      teamId: "mock-roast-2",
      teamPublicId: "mock-roast-2",
      teamName: "Bayou Ballers",
      ownerName: "Sam Cole",
      logoUrl: null,
      value: 78.2,
    },
    underachiever: {
      teamId: "mock-roast-3",
      teamPublicId: "mock-roast-3",
      teamName: "Soft Zone Society",
      ownerName: "Jordan Blake",
      logoUrl: null,
      value: 42.4,
    },
  };
}
