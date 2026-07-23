import { randomUUID } from "node:crypto";

import {
  drafts,
  leagues,
  leagueSeasons,
  players,
  positions,
  profiles,
  rosterPlayers,
  teams,
} from "@/db/schema";
import type {
  LeagueSeasonSettings,
  RosterSlotConfig,
} from "@/db/schema/league-seasons";
import type { rosterPlayerStatusEnum } from "@/db/schema/roster-players";
import { DEFAULT_DRAFT_SETTINGS } from "@/lib/leagues/draft-settings";
import { buildStandardRosterSlots } from "@/lib/leagues/defaults";
import { DEFAULT_IR_ELIGIBLE_STATUSES } from "@/lib/leagues/ir-eligibility";
import { DEFAULT_WAIVER_WIRE_SETTINGS } from "@/lib/leagues/waiver-wire";
import type { TestDb } from "@/lib/test/harness";

/** Standard offense positions, mirrors `db/seed/positions.ts`. */
export async function seedPositions(testDb: TestDb) {
  await testDb
    .insert(positions)
    .values([
      { id: "QB", name: "Quarterback", side: "offense", sortOrder: 1, isStarterSlot: true },
      { id: "RB", name: "Running Back", side: "offense", sortOrder: 2, isStarterSlot: true },
      { id: "WR", name: "Wide Receiver", side: "offense", sortOrder: 3, isStarterSlot: true },
      { id: "TE", name: "Tight End", side: "offense", sortOrder: 4, isStarterSlot: true },
      { id: "FLEX", name: "Flex", side: "flex", sortOrder: 5, isStarterSlot: true },
      { id: "K", name: "Kicker", side: "special", sortOrder: 6, isStarterSlot: true },
      { id: "DEF", name: "Defense", side: "defense", sortOrder: 7, isStarterSlot: true },
      { id: "BN", name: "Bench", side: "offense", sortOrder: 8, isStarterSlot: false },
      { id: "IR", name: "Injured Reserve", side: "offense", sortOrder: 9, isStarterSlot: false },
      { id: "TAXI", name: "Taxi", side: "offense", sortOrder: 10, isStarterSlot: false },
    ])
    .onConflictDoNothing();
}

export async function seedProfile(
  testDb: TestDb,
  overrides: { displayName?: string } = {},
) {
  const id = randomUUID();
  await testDb.insert(profiles).values({
    id,
    displayName: overrides.displayName ?? "Test Manager",
  });
  return { id };
}

export async function seedLeagueSeason(
  testDb: TestDb,
  overrides: {
    status?: "setup" | "recruiting" | "draft" | "active";
    teamCount?: number;
    benchSlots?: number;
    irEnabled?: boolean;
    taxiEnabled?: boolean;
    waiversEnabled?: boolean;
    waiverType?: "priority" | "faab";
    faabBudget?: number | null;
    tradesEnabled?: boolean;
    tradeProcessing?: "commissioner" | "review_24h" | "instant";
    pickTimeLimitSeconds?: number;
    lastWaiverProcessedAt?: Date | null;
    rosterSlots?: RosterSlotConfig[];
    settings?: Partial<LeagueSeasonSettings>;
  } = {},
) {
  const commissioner = await seedProfile(testDb, { displayName: "Commissioner" });
  const leagueId = randomUUID();
  const shortId = leagueId.slice(0, 8);

  await testDb.insert(leagues).values({
    id: leagueId,
    name: "Test League",
    publicId: `test-league-${shortId}`,
    slug: `test-league-${shortId}`,
    inviteCode: `INV${shortId}`,
    commissionerId: commissioner.id,
  });

  const benchSlots = overrides.benchSlots ?? 6;
  const rosterSlots =
    overrides.rosterSlots ?? buildStandardRosterSlots(benchSlots, 0, 0);

  const settings: LeagueSeasonSettings = {
    rosterSlots,
    waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
    draft: DEFAULT_DRAFT_SETTINGS,
    irEligibleStatuses: [...DEFAULT_IR_ELIGIBLE_STATUSES],
    ...overrides.settings,
  };

  const [season] = await testDb
    .insert(leagueSeasons)
    .values({
      leagueId,
      seasonYear: 2026,
      status: overrides.status ?? "active",
      teamCount: overrides.teamCount ?? 2,
      playoffTeamCount: 2,
      championshipWeek: 17,
      regularSeasonEndWeek: 14,
      benchSlots,
      irEnabled: overrides.irEnabled ?? false,
      taxiEnabled: overrides.taxiEnabled ?? false,
      waiversEnabled: overrides.waiversEnabled ?? true,
      waiverType: overrides.waiverType ?? "priority",
      faabBudget: overrides.faabBudget ?? null,
      tradesEnabled: overrides.tradesEnabled ?? true,
      tradeProcessing: overrides.tradeProcessing ?? "review_24h",
      draftStartAt: new Date(),
      pickTimeLimitSeconds: overrides.pickTimeLimitSeconds ?? 90,
      lastWaiverProcessedAt: overrides.lastWaiverProcessedAt ?? null,
      settings,
    })
    .returning();

  if (!season) {
    throw new Error("Failed to seed league season.");
  }

  return { leagueId, commissionerId: commissioner.id, season };
}

export async function seedTeams(
  testDb: TestDb,
  input: {
    leagueSeasonId: string;
    count: number;
    namePrefix?: string;
  },
) {
  const prefix = input.namePrefix ?? "Team";
  const rows: Array<{
    id: string;
    userId: string;
    name: string;
    draftSlot: number;
  }> = [];

  for (let i = 0; i < input.count; i++) {
    const owner = await seedProfile(testDb, { displayName: `${prefix} ${i + 1} Owner` });
    const [row] = await testDb
      .insert(teams)
      .values({
        leagueSeasonId: input.leagueSeasonId,
        userId: owner.id,
        name: `${prefix} ${i + 1}`,
        draftSlot: i + 1,
        waiverPriority: i + 1,
      })
      .returning({ id: teams.id });
    if (!row) {
      throw new Error("Failed to seed team.");
    }
    rows.push({ id: row.id, userId: owner.id, name: `${prefix} ${i + 1}`, draftSlot: i + 1 });
  }

  return rows;
}

export async function seedPlayers(
  testDb: TestDb,
  list: Array<{ fullName: string; primaryPositionId: string; injuryStatus?: string | null }>,
) {
  const rows: Array<{ id: string; fullName: string; primaryPositionId: string }> = [];
  for (const entry of list) {
    const [row] = await testDb
      .insert(players)
      .values({
        fullName: entry.fullName,
        primaryPositionId: entry.primaryPositionId,
        injuryStatus: entry.injuryStatus ?? null,
      })
      .returning({ id: players.id });
    if (!row) {
      throw new Error("Failed to seed player.");
    }
    rows.push({
      id: row.id,
      fullName: entry.fullName,
      primaryPositionId: entry.primaryPositionId,
    });
  }
  return rows;
}

export async function seedDraft(
  testDb: TestDb,
  input: {
    leagueSeasonId: string;
    currentPickIndex?: number;
    status?: "scheduled" | "live" | "paused" | "complete";
  },
) {
  const [row] = await testDb
    .insert(drafts)
    .values({
      leagueSeasonId: input.leagueSeasonId,
      status: input.status ?? "live",
      currentPickIndex: input.currentPickIndex ?? 0,
      startedAt: new Date(),
    })
    .returning({ id: drafts.id });
  if (!row) {
    throw new Error("Failed to seed draft.");
  }
  return { id: row.id };
}

export async function seedRosterPlayer(
  testDb: TestDb,
  input: {
    leagueSeasonId: string;
    teamId: string;
    playerId: string;
    status?: (typeof rosterPlayerStatusEnum.enumValues)[number];
    slotPositionId?: string | null;
    waiverClearsAt?: Date | null;
  },
) {
  const [row] = await testDb
    .insert(rosterPlayers)
    .values({
      leagueSeasonId: input.leagueSeasonId,
      teamId: input.teamId,
      playerId: input.playerId,
      status: input.status ?? "rostered",
      slotPositionId: input.slotPositionId ?? null,
      waiverClearsAt: input.waiverClearsAt ?? null,
      acquiredAt: new Date(),
    })
    .returning({ id: rosterPlayers.id });
  if (!row) {
    throw new Error("Failed to seed roster player.");
  }
  return { id: row.id };
}
