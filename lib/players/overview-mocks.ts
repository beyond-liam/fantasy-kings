/**
 * TEMPORARY — delete when Overview has enough real data to demo.
 * Applies position-keyed mock season stats + game log + Overview extras
 * so QB / RB / WR|TE / K / DEF pages can exercise the full Overview panel.
 */
import { WIZARD_DEFAULTS } from "@/lib/leagues/defaults";
import {
  getPlayoffWeekRange,
  getRegularSeasonEndWeek,
  listWeeksInclusive,
} from "@/lib/leagues/season-calendar";
import type {
  OverviewExtrasSeed,
  OverviewMatchupBucketId,
  OverviewRosterCompareSeedRow,
} from "@/lib/players/overview-metrics";
import type { PlayerProfileGameLogRow } from "@/lib/queries/player-profile";

export const USE_PLAYER_OVERVIEW_MOCKS = false;

type MockSeasonBlock = {
  fantasyPts: number | null;
  stats: Record<string, number | null>;
};

type PositionMock = {
  byeWeek: number;
  /** Full-season outlook (week-0 projection). */
  seasonProjection: MockSeasonBlock;
  /** Year-to-date actuals (week-0 stats). */
  seasonStats: MockSeasonBlock;
  gameLog: PlayerProfileGameLogRow[];
  extras: OverviewExtrasSeed;
};

/** Full NFL slate for the schedule wheel (bye week 8). */
const SHARED_SCHEDULE = [
  { week: 1, opponent: "@ SEA" },
  { week: 2, opponent: "vs BAL" },
  { week: 3, opponent: "@ BUF" },
  { week: 4, opponent: "vs DEN" },
  { week: 5, opponent: "@ CIN" },
  { week: 6, opponent: "vs LV" },
  { week: 7, opponent: "@ NYJ" },
  { week: 8, opponent: "BYE" },
  { week: 9, opponent: "vs SF" },
  { week: 10, opponent: "@ MIA" },
  { week: 11, opponent: "vs CLE" },
  { week: 12, opponent: "@ PIT" },
  { week: 13, opponent: "vs TEN" },
  { week: 14, opponent: "@ IND" },
  { week: 15, opponent: "vs CHI" },
  { week: 16, opponent: "@ DET" },
  { week: 17, opponent: "vs GB" },
  { week: 18, opponent: "@ MIN" },
] as const;

const RB_ROSTER_COMPARE: OverviewRosterCompareSeedRow[] = [
  {
    id: "roster-rb1",
    name: "Saquon Barkley",
    nflTeam: "PHI",
    sleeperId: "4866",
    primaryPositionId: "RB",
    slotLabel: "RB1",
    gamesPlayed: 11,
    carrySharePct: 58,
    ypc: 4.6,
    fptsPerGame: 19.8,
    totalFpts: 217.8,
    homeAvg: 21.2,
    awayAvg: 18.1,
    floor: 11.4,
    median: 18.6,
    ceiling: 28.2,
    consistencyScore: 72,
    avgWeeklyFinish: 8.4,
    startablePct: 64,
    remainingSosRank: 14,
  },
  {
    id: "roster-rb2",
    name: "Kyren Williams",
    nflTeam: "LAR",
    sleeperId: "8150",
    primaryPositionId: "RB",
    slotLabel: "RB2",
    gamesPlayed: 11,
    carrySharePct: 54,
    ypc: 4.1,
    fptsPerGame: 15.2,
    totalFpts: 167.2,
    homeAvg: 16.8,
    awayAvg: 13.4,
    floor: 8.2,
    median: 14.1,
    ceiling: 22.5,
    consistencyScore: 61,
    avgWeeklyFinish: 14.2,
    startablePct: 45,
    remainingSosRank: 18,
  },
  {
    id: "roster-rb-bench",
    name: "Jaylen Warren",
    nflTeam: "PIT",
    sleeperId: "8228",
    primaryPositionId: "RB",
    slotLabel: "Bench",
    gamesPlayed: 11,
    carrySharePct: 38,
    ypc: 4.4,
    fptsPerGame: 11.1,
    totalFpts: 122.1,
    homeAvg: 12.4,
    awayAvg: 9.6,
    floor: 5.1,
    median: 10.2,
    ceiling: 17.8,
    consistencyScore: 54,
    avgWeeklyFinish: 22.6,
    startablePct: 27,
    remainingSosRank: 12,
  },
];

/** Match wizard defaults: 4-team playoffs, championship week 17 → RS ends 15. */
const MOCK_PLAYOFF_RANGE = getPlayoffWeekRange(
  WIZARD_DEFAULTS.championshipWeek,
  WIZARD_DEFAULTS.playoffTeamCount,
)!;
const PLAYOFF_WEEKS = listWeeksInclusive(
  MOCK_PLAYOFF_RANGE.startWeek,
  MOCK_PLAYOFF_RANGE.endWeek,
);
const REGULAR_SEASON_END_WEEK = getRegularSeasonEndWeek(
  WIZARD_DEFAULTS.championshipWeek,
  WIZARD_DEFAULTS.playoffTeamCount,
);

/** Matchup ranks 1 = hardest … 32 = easiest (bye omitted). */
const SHARED_RANKS: Record<number, number> = {
  1: 29,
  2: 24,
  3: 27,
  4: 6,
  5: 22,
  6: 8,
  7: 4,
  9: 18,
  10: 26,
  11: 5,
  12: 3,
  13: 16,
  14: 20,
  15: 14,
  16: 7,
  17: 25,
  18: 28,
};

const SHARED_PTS_ALLOWED: Record<number, number> = {
  1: 6.2,
  2: 8.4,
  3: 7.1,
  4: 18.6,
  5: 9.8,
  6: 17.2,
  7: 19.4,
  9: 11.5,
  10: 7.8,
  11: 18.9,
  12: 20.1,
  13: 12.4,
  14: 10.6,
  15: 13.2,
  16: 17.8,
  17: 8.1,
  18: 6.9,
};

function weeks(
  rows: Array<{
    fantasyPts: number | null;
    stats: Record<string, number | null>;
  }>,
): PlayerProfileGameLogRow[] {
  return SHARED_SCHEDULE.map((slot, index) => {
    const row = rows[index];
    const isBye = slot.opponent === "BYE";
    return {
      week: slot.week,
      opponent: slot.opponent,
      fantasyPts: isBye ? null : (row?.fantasyPts ?? null),
      stats: isBye ? {} : (row?.stats ?? {}),
    };
  });
}

function difficultyFromRanks(
  ranks: Record<number, number>,
): Record<number, OverviewMatchupBucketId> {
  const map: Record<number, OverviewMatchupBucketId> = {};
  for (const [week, rank] of Object.entries(ranks)) {
    const w = Number(week);
    if (rank <= 10) map[w] = "easy";
    else if (rank <= 22) map[w] = "mid";
    else map[w] = "hard";
  }
  return map;
}

function sosExtras(
  rest: Omit<
    OverviewExtrasSeed,
    | "matchupDifficultyByWeek"
    | "matchupRanksByWeek"
    | "ptsAllowedByWeek"
    | "playoffWeeks"
    | "regularSeasonEndWeek"
  >,
): OverviewExtrasSeed {
  return {
    ...rest,
    matchupDifficultyByWeek: difficultyFromRanks(SHARED_RANKS),
    matchupRanksByWeek: SHARED_RANKS,
    ptsAllowedByWeek: SHARED_PTS_ALLOWED,
    playoffWeeks: PLAYOFF_WEEKS,
    regularSeasonEndWeek: REGULAR_SEASON_END_WEEK,
  };
}

const EMPTY_TAIL = Array.from({ length: 6 }, () => ({
  fantasyPts: null as number | null,
  stats: {} as Record<string, number | null>,
}));

const QB_MOCK: PositionMock = {
  byeWeek: 8,
  seasonProjection: {
    fantasyPts: 352.8,
    stats: {
      gp: 17,
      pass_yd: 4250,
      pass_td: 32,
      pass_int: 11,
      pass_cmp: 365,
      pass_att: 550,
      rush_yd: 380,
      rush_td: 4,
      rush_att: 65,
    },
  },
  seasonStats: {
    fantasyPts: 268.4,
    stats: {
      gp: 11,
      pass_yd: 3120,
      pass_td: 24,
      pass_int: 7,
      pass_cmp: 265,
      pass_att: 398,
      rush_yd: 285,
      rush_td: 3,
      rush_att: 48,
    },
  },
  gameLog: weeks([
    {
      fantasyPts: 22.4,
      stats: {
        pass_yd: 278,
        pass_td: 2,
        pass_int: 0,
        pass_cmp: 24,
        pass_att: 35,
        rush_yd: 18,
      },
    },
    {
      fantasyPts: 14.1,
      stats: {
        pass_yd: 210,
        pass_td: 1,
        pass_int: 1,
        pass_cmp: 19,
        pass_att: 32,
        rush_yd: 12,
      },
    },
    {
      fantasyPts: 31.8,
      stats: {
        pass_yd: 342,
        pass_td: 3,
        pass_int: 0,
        pass_cmp: 28,
        pass_att: 39,
        rush_yd: 41,
      },
    },
    {
      fantasyPts: 18.6,
      stats: {
        pass_yd: 255,
        pass_td: 2,
        pass_int: 1,
        pass_cmp: 22,
        pass_att: 34,
        rush_yd: 8,
      },
    },
    {
      fantasyPts: 9.2,
      stats: {
        pass_yd: 168,
        pass_td: 0,
        pass_int: 2,
        pass_cmp: 16,
        pass_att: 29,
        rush_yd: 22,
      },
    },
    {
      fantasyPts: 27.5,
      stats: {
        pass_yd: 301,
        pass_td: 3,
        pass_int: 0,
        pass_cmp: 26,
        pass_att: 36,
        rush_yd: 15,
      },
    },
    {
      fantasyPts: 20.3,
      stats: {
        pass_yd: 244,
        pass_td: 2,
        pass_int: 0,
        pass_cmp: 21,
        pass_att: 31,
        rush_yd: 31,
      },
    },
    { fantasyPts: null, stats: {} },
    {
      fantasyPts: 35.1,
      stats: {
        pass_yd: 388,
        pass_td: 4,
        pass_int: 1,
        pass_cmp: 31,
        pass_att: 42,
        rush_yd: 28,
      },
    },
    {
      fantasyPts: 16.8,
      stats: {
        pass_yd: 229,
        pass_td: 1,
        pass_int: 0,
        pass_cmp: 20,
        pass_att: 33,
        rush_yd: 35,
      },
    },
    {
      fantasyPts: 24.7,
      stats: {
        pass_yd: 295,
        pass_td: 2,
        pass_int: 1,
        pass_cmp: 25,
        pass_att: 37,
        rush_yd: 42,
      },
    },
    {
      fantasyPts: 19.9,
      stats: {
        pass_yd: 260,
        pass_td: 2,
        pass_int: 0,
        pass_cmp: 23,
        pass_att: 34,
        rush_yd: 18,
      },
    },
    ...EMPTY_TAIL,
  ]),
  extras: sosExtras({
    share: {
      kind: "pass",
      label: "Team pass attempts",
      playerPct: 96,
      playerTotal: 398,
      teamTotal: 415,
    },
    weeklyFinishesByWeek: {
      1: 8,
      2: 18,
      3: 2,
      4: 11,
      5: 28,
      6: 4,
      7: 9,
      9: 1,
      10: 14,
      11: 6,
      12: 10,
    },
    multiYear: [
      { season: "2025", games: 11, fptsPerGame: 21.9, positionRank: 6 },
      { season: "2024", games: 17, fptsPerGame: 20.1, positionRank: 8 },
      { season: "2023", games: 16, fptsPerGame: 18.4, positionRank: 12 },
      { season: "2022", games: 15, fptsPerGame: 16.9, positionRank: 15 },
    ],
  }),
};

const RB_MOCK: PositionMock = {
  byeWeek: 8,
  seasonProjection: {
    fantasyPts: 285.6,
    stats: {
      gp: 17,
      rush_att: 280,
      rush_yd: 1350,
      rush_td: 12,
      rec: 58,
      rec_yd: 420,
      rec_td: 3,
      rec_tgt: 75,
    },
  },
  seasonStats: {
    fantasyPts: 198.6,
    stats: {
      gp: 11,
      rush_att: 185,
      rush_yd: 920,
      rush_td: 8,
      rec: 42,
      rec_yd: 310,
      rec_td: 2,
      rec_tgt: 55,
    },
  },
  gameLog: weeks([
    {
      fantasyPts: 18.4,
      stats: { rush_att: 18, rush_yd: 82, rush_td: 1, rec: 3, rec_yd: 22 },
    },
    {
      fantasyPts: 8.1,
      stats: { rush_att: 12, rush_yd: 41, rush_td: 0, rec: 2, rec_yd: 20 },
    },
    {
      fantasyPts: 28.6,
      stats: { rush_att: 22, rush_yd: 124, rush_td: 2, rec: 4, rec_yd: 42 },
    },
    {
      fantasyPts: 14.2,
      stats: { rush_att: 16, rush_yd: 68, rush_td: 0, rec: 5, rec_yd: 34 },
    },
    {
      fantasyPts: 6.4,
      stats: { rush_att: 9, rush_yd: 28, rush_td: 0, rec: 2, rec_yd: 16 },
    },
    {
      fantasyPts: 22.8,
      stats: { rush_att: 20, rush_yd: 95, rush_td: 1, rec: 6, rec_yd: 48 },
    },
    /** Week 7 — DNP (past week with no score; later weeks scored). */
    { fantasyPts: null, stats: {} },
    { fantasyPts: null, stats: {} },
    {
      fantasyPts: 31.2,
      stats: { rush_att: 24, rush_yd: 142, rush_td: 2, rec: 5, rec_yd: 40 },
    },
    {
      fantasyPts: 15.7,
      stats: { rush_att: 17, rush_yd: 74, rush_td: 1, rec: 3, rec_yd: 13 },
    },
    {
      fantasyPts: 9.9,
      stats: { rush_att: 11, rush_yd: 38, rush_td: 0, rec: 4, rec_yd: 21 },
    },
    {
      fantasyPts: 17.3,
      stats: { rush_att: 15, rush_yd: 71, rush_td: 1, rec: 3, rec_yd: 22 },
    },
    ...EMPTY_TAIL,
  ]),
  extras: sosExtras({
    share: {
      kind: "carry",
      label: "Carry share",
      playerPct: 62,
      playerTotal: 185,
      teamTotal: 298,
    },
    weeklyFinishesByWeek: {
      1: 10,
      2: 32,
      3: 3,
      4: 16,
      5: 41,
      6: 5,
      7: 22,
      9: 1,
      10: 12,
      11: 28,
      12: 9,
    },
    rosterCompare: RB_ROSTER_COMPARE,
    multiYear: [
      { season: "2025", games: 11, fptsPerGame: 16.7, positionRank: 14 },
      { season: "2024", games: 16, fptsPerGame: 15.2, positionRank: 18 },
      { season: "2023", games: 14, fptsPerGame: 12.8, positionRank: 28 },
      { season: "2022", games: 13, fptsPerGame: 11.1, positionRank: 35 },
    ],
  }),
};

const WR_TE_MOCK: PositionMock = {
  byeWeek: 8,
  seasonProjection: {
    fantasyPts: 248.2,
    stats: {
      gp: 17,
      rec: 105,
      rec_yd: 1380,
      rec_td: 10,
      rec_tgt: 155,
      rush_yd: 40,
      rush_td: 0,
    },
  },
  seasonStats: {
    fantasyPts: 176.2,
    stats: {
      gp: 11,
      rec: 72,
      rec_yd: 945,
      rec_td: 7,
      rec_tgt: 108,
      rush_yd: 48,
      rush_td: 1,
      rush_att: 8,
    },
  },
  gameLog: weeks([
    {
      fantasyPts: 16.8,
      stats: { rec: 6, rec_yd: 78, rec_td: 1, rec_tgt: 9 },
    },
    {
      fantasyPts: 7.4,
      stats: { rec: 3, rec_yd: 44, rec_td: 0, rec_tgt: 7 },
    },
    {
      fantasyPts: 26.1,
      stats: { rec: 9, rec_yd: 121, rec_td: 1, rec_tgt: 12 },
    },
    {
      fantasyPts: 12.2,
      stats: { rec: 5, rec_yd: 72, rec_td: 0, rec_tgt: 8 },
    },
    {
      fantasyPts: 4.8,
      stats: { rec: 2, rec_yd: 28, rec_td: 0, rec_tgt: 6 },
    },
    {
      fantasyPts: 21.5,
      stats: { rec: 8, rec_yd: 95, rec_td: 1, rec_tgt: 11 },
    },
    {
      fantasyPts: 13.9,
      stats: { rec: 5, rec_yd: 69, rec_td: 0, rec_tgt: 9 },
    },
    { fantasyPts: null, stats: {} },
    {
      fantasyPts: 29.4,
      stats: { rec: 10, rec_yd: 134, rec_td: 2, rec_tgt: 13 },
    },
    {
      fantasyPts: 11.1,
      stats: { rec: 4, rec_yd: 51, rec_td: 0, rec_tgt: 7 },
    },
    {
      fantasyPts: 18.6,
      stats: { rec: 7, rec_yd: 86, rec_td: 1, rec_tgt: 10 },
    },
    {
      fantasyPts: 14.4,
      stats: { rec: 6, rec_yd: 64, rec_td: 0, rec_tgt: 8 },
    },
    ...EMPTY_TAIL,
  ]),
  extras: sosExtras({
    share: {
      kind: "target",
      label: "Target share",
      playerPct: 27,
      playerTotal: 108,
      teamTotal: 400,
    },
    weeklyFinishesByWeek: {
      1: 14,
      2: 48,
      3: 4,
      4: 26,
      5: 62,
      6: 7,
      7: 22,
      9: 2,
      10: 31,
      11: 11,
      12: 18,
    },
    multiYear: [
      { season: "2025", games: 11, fptsPerGame: 14.9, positionRank: 18 },
      { season: "2024", games: 17, fptsPerGame: 13.2, positionRank: 24 },
      { season: "2023", games: 15, fptsPerGame: 11.6, positionRank: 32 },
      { season: "2022", games: 14, fptsPerGame: 9.8, positionRank: 41 },
    ],
  }),
};

const K_ROSTER_COMPARE: OverviewRosterCompareSeedRow[] = [
  {
    id: "roster-k1",
    name: "Justin Tucker",
    nflTeam: "BAL",
    sleeperId: "1264",
    primaryPositionId: "K",
    slotLabel: "K",
    gamesPlayed: 11,
    carrySharePct: null,
    ypc: null,
    fptsPerGame: 9.8,
    totalFpts: 107.8,
    homeAvg: 10.4,
    awayAvg: 9.1,
    floor: 4.0,
    median: 9.0,
    ceiling: 16.0,
    consistencyScore: 58,
    avgWeeklyFinish: 9.2,
    startablePct: 55,
    remainingSosRank: 16,
  },
];

const DEF_ROSTER_COMPARE: OverviewRosterCompareSeedRow[] = [
  {
    id: "roster-def1",
    name: "Broncos",
    nflTeam: "DEN",
    sleeperId: "DEN",
    primaryPositionId: "DEF",
    slotLabel: "DEF",
    gamesPlayed: 11,
    carrySharePct: null,
    ypc: null,
    fptsPerGame: 9.4,
    totalFpts: 103.4,
    homeAvg: 10.8,
    awayAvg: 7.9,
    floor: 2.0,
    median: 8.5,
    ceiling: 18.0,
    consistencyScore: 52,
    avgWeeklyFinish: 10.1,
    startablePct: 48,
    remainingSosRank: 11,
  },
];

const DEF_MOCK: PositionMock = {
  byeWeek: 8,
  seasonProjection: {
    fantasyPts: 128.0,
    stats: {
      gp: 17,
      sack: 48,
      tkl_solo: 62,
      int: 15,
      ff: 14,
      fum_rec: 10,
      def_td: 3,
      pts_allow: 340,
    },
  },
  seasonStats: {
    fantasyPts: 92.0,
    stats: {
      gp: 11,
      sack: 31,
      tkl_solo: 41,
      int: 10,
      ff: 9,
      fum_rec: 6,
      def_td: 2,
      pts_allow: 168,
    },
  },
  gameLog: weeks([
    {
      fantasyPts: 12.0,
      stats: {
        sack: 4,
        tkl_solo: 5,
        int: 1,
        ff: 1,
        def_td: 0,
        pts_allow: 10,
      },
    },
    {
      fantasyPts: 4.0,
      stats: {
        sack: 1,
        tkl_solo: 3,
        int: 0,
        ff: 0,
        def_td: 0,
        pts_allow: 17,
      },
    },
    {
      fantasyPts: 16.0,
      stats: {
        sack: 5,
        tkl_solo: 4,
        int: 2,
        ff: 1,
        def_td: 1,
        pts_allow: 3,
      },
    },
    {
      fantasyPts: 2.0,
      stats: {
        sack: 1,
        tkl_solo: 2,
        int: 0,
        ff: 0,
        def_td: 0,
        pts_allow: 24,
      },
    },
    {
      fantasyPts: 11.0,
      stats: {
        sack: 3,
        tkl_solo: 5,
        int: 1,
        ff: 2,
        def_td: 0,
        pts_allow: 7,
      },
    },
    {
      fantasyPts: 8.0,
      stats: {
        sack: 2,
        tkl_solo: 4,
        int: 1,
        ff: 1,
        def_td: 0,
        pts_allow: 14,
      },
    },
    { fantasyPts: null, stats: {} },
    { fantasyPts: null, stats: {} },
    {
      fantasyPts: 5.0,
      stats: {
        sack: 2,
        tkl_solo: 3,
        int: 0,
        ff: 1,
        def_td: 0,
        pts_allow: 21,
      },
    },
    {
      fantasyPts: 14.0,
      stats: {
        sack: 4,
        tkl_solo: 5,
        int: 2,
        ff: 1,
        def_td: 1,
        pts_allow: 6,
      },
    },
    {
      fantasyPts: 1.0,
      stats: {
        sack: 1,
        tkl_solo: 2,
        int: 0,
        ff: 0,
        def_td: 0,
        pts_allow: 28,
      },
    },
    {
      fantasyPts: 9.0,
      stats: {
        sack: 3,
        tkl_solo: 4,
        int: 1,
        ff: 1,
        def_td: 0,
        pts_allow: 11,
      },
    },
    ...EMPTY_TAIL,
  ]),
  extras: sosExtras({
    share: null,
    weeklyFinishesByWeek: {
      1: 5,
      2: 24,
      3: 2,
      4: 28,
      5: 7,
      6: 12,
      9: 20,
      10: 4,
      11: 30,
      12: 10,
    },
    rosterCompare: DEF_ROSTER_COMPARE,
    multiYear: [
      { season: "2025", games: 11, fptsPerGame: 8.4, positionRank: 9 },
      { season: "2024", games: 17, fptsPerGame: 7.6, positionRank: 14 },
      { season: "2023", games: 17, fptsPerGame: 9.1, positionRank: 6 },
      { season: "2022", games: 17, fptsPerGame: 6.8, positionRank: 18 },
    ],
  }),
};

const K_MOCK: PositionMock = {
  byeWeek: 8,
  seasonProjection: {
    fantasyPts: 142.0,
    stats: {
      gp: 17,
      fgm: 32,
      fga: 37,
      fgm_0_19: 1,
      fgm_20_29: 8,
      fgm_30_39: 10,
      fgm_40_49: 8,
      fgm_50p: 5,
      xpm: 38,
      xpa: 39,
      xpmiss: 1,
    },
  },
  seasonStats: {
    fantasyPts: 98.0,
    stats: {
      gp: 11,
      fgm: 22,
      fga: 26,
      fgm_0_19: 1,
      fgm_20_29: 5,
      fgm_30_39: 7,
      fgm_40_49: 6,
      fgm_50p: 3,
      fgmiss_20_29: 1,
      fgmiss_30_39: 1,
      fgmiss_40_49: 1,
      fgmiss_50p: 1,
      xpm: 26,
      xpa: 27,
      xpmiss: 1,
    },
  },
  gameLog: weeks([
    {
      fantasyPts: 11.0,
      stats: {
        fgm: 2,
        fga: 2,
        fgm_30_39: 1,
        fgm_40_49: 1,
        xpm: 2,
        xpa: 2,
      },
    },
    {
      fantasyPts: 5.0,
      stats: {
        fgm: 1,
        fga: 2,
        fgm_20_29: 1,
        fgmiss_40_49: 1,
        xpm: 2,
        xpa: 2,
      },
    },
    {
      fantasyPts: 14.0,
      stats: {
        fgm: 3,
        fga: 3,
        fgm_30_39: 1,
        fgm_40_49: 1,
        fgm_50p: 1,
        xpm: 2,
        xpa: 2,
      },
    },
    {
      fantasyPts: 8.0,
      stats: {
        fgm: 2,
        fga: 2,
        fgm_20_29: 1,
        fgm_30_39: 1,
        xpm: 2,
        xpa: 2,
      },
    },
    {
      fantasyPts: 3.0,
      stats: {
        fgm: 0,
        fga: 1,
        fgmiss_50p: 1,
        xpm: 3,
        xpa: 3,
      },
    },
    {
      fantasyPts: 12.0,
      stats: {
        fgm: 3,
        fga: 3,
        fgm_0_19: 1,
        fgm_40_49: 1,
        fgm_50p: 1,
        xpm: 1,
        xpa: 2,
        xpmiss: 1,
      },
    },
    { fantasyPts: null, stats: {} },
    { fantasyPts: null, stats: {} },
    {
      fantasyPts: 9.0,
      stats: {
        fgm: 2,
        fga: 2,
        fgm_30_39: 1,
        fgm_40_49: 1,
        xpm: 3,
        xpa: 3,
      },
    },
    {
      fantasyPts: 7.0,
      stats: {
        fgm: 1,
        fga: 2,
        fgm_50p: 1,
        fgmiss_30_39: 1,
        xpm: 4,
        xpa: 4,
      },
    },
    {
      fantasyPts: 10.0,
      stats: {
        fgm: 2,
        fga: 2,
        fgm_20_29: 1,
        fgm_30_39: 1,
        xpm: 4,
        xpa: 4,
      },
    },
    {
      fantasyPts: 6.0,
      stats: {
        fgm: 1,
        fga: 1,
        fgm_40_49: 1,
        xpm: 3,
        xpa: 3,
      },
    },
    ...EMPTY_TAIL,
  ]),
  extras: sosExtras({
    share: null,
    weeklyFinishesByWeek: {
      1: 6,
      2: 22,
      3: 2,
      4: 14,
      5: 28,
      6: 4,
      9: 8,
      10: 18,
      11: 7,
      12: 16,
    },
    rosterCompare: K_ROSTER_COMPARE,
    multiYear: [
      { season: "2025", games: 11, fptsPerGame: 8.9, positionRank: 8 },
      { season: "2024", games: 17, fptsPerGame: 8.4, positionRank: 12 },
      { season: "2023", games: 16, fptsPerGame: 7.9, positionRank: 15 },
      { season: "2022", games: 17, fptsPerGame: 8.1, positionRank: 11 },
    ],
  }),
};

function mockForPosition(positionId: string): PositionMock | null {
  switch (positionId) {
    case "QB":
      return QB_MOCK;
    case "RB":
      return RB_MOCK;
    case "WR":
    case "TE":
      return WR_TE_MOCK;
    case "K":
      return K_MOCK;
    case "DEF":
      return DEF_MOCK;
    default:
      return null;
  }
}

/** Overlay temporary Overview demo data onto a profile (QB / RB / WR|TE / K / DEF). */
export function applyPlayerOverviewMocks<
  T extends {
    primaryPositionId: string;
    byeWeek: number | null;
    seasonProjection: MockSeasonBlock | null;
    seasonStats: MockSeasonBlock | null;
    gameLog: PlayerProfileGameLogRow[];
    overviewExtras?: OverviewExtrasSeed | null;
    identity?: {
      byeWeek: number | null;
      seasonProjection: MockSeasonBlock | null;
      seasonStats: MockSeasonBlock | null;
    };
  },
>(profile: T): T {
  if (!USE_PLAYER_OVERVIEW_MOCKS) return profile;
  const mock = mockForPosition(profile.primaryPositionId);
  if (!mock) return profile;

  return {
    ...profile,
    byeWeek: mock.byeWeek,
    seasonStats: mock.seasonStats,
    seasonProjection: mock.seasonProjection,
    gameLog: mock.gameLog,
    overviewExtras: mock.extras,
    ...(profile.identity
      ? {
          identity: {
            ...profile.identity,
            byeWeek: mock.byeWeek,
            seasonProjection: mock.seasonProjection,
            seasonStats: mock.seasonStats,
          },
        }
      : {}),
  } as T;
}
