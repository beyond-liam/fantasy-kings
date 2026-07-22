import type { leagues } from "@/db/schema/leagues";

export type MockLeague = typeof leagues.$inferSelect;

export const mockLeagues: MockLeague[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Test League",
    publicId: "TEST01",
    slug: "test-league",
    inviteCode: "TESTLEAGUE",
    commissionerId: "00000000-0000-4000-8000-000000000099",
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
  },
];
