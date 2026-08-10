import "./load-env";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { positions } from "../schema/positions";
import { createSeedClient } from "./client";

const seedPositionsRows = [
  { id: "QB", name: "Quarterback", side: "offense" as const, sortOrder: 1, isStarterSlot: true },
  { id: "RB", name: "Running Back", side: "offense" as const, sortOrder: 2, isStarterSlot: true },
  { id: "WR", name: "Wide Receiver", side: "offense" as const, sortOrder: 3, isStarterSlot: true },
  { id: "TE", name: "Tight End", side: "offense" as const, sortOrder: 4, isStarterSlot: true },
  { id: "FLEX", name: "Flex", side: "flex" as const, sortOrder: 5, isStarterSlot: true },
  { id: "K", name: "Kicker", side: "special" as const, sortOrder: 6, isStarterSlot: true },
  { id: "DEF", name: "Team Defense", side: "defense" as const, sortOrder: 7, isStarterSlot: true },
  { id: "CB", name: "Cornerback", side: "defense" as const, sortOrder: 8, isStarterSlot: true },
  { id: "S", name: "Safety", side: "defense" as const, sortOrder: 9, isStarterSlot: true },
  { id: "DT", name: "Defensive Tackle", side: "defense" as const, sortOrder: 10, isStarterSlot: true },
  { id: "DE", name: "Defensive End", side: "defense" as const, sortOrder: 11, isStarterSlot: true },
  { id: "LB", name: "Linebacker", side: "defense" as const, sortOrder: 12, isStarterSlot: true },
  { id: "BN", name: "Bench", side: "offense" as const, sortOrder: 13, isStarterSlot: false },
  { id: "IR", name: "Injured Reserve", side: "offense" as const, sortOrder: 14, isStarterSlot: false },
  { id: "TAXI", name: "Taxi", side: "offense" as const, sortOrder: 15, isStarterSlot: false },
];

async function seedPositions() {
  const client = createSeedClient();
  const db = drizzle(client);

  await db
    .insert(positions)
    .values(seedPositionsRows)
    .onConflictDoUpdate({
      target: positions.id,
      set: {
        name: sql`excluded.name`,
        side: sql`excluded.side`,
        sortOrder: sql`excluded.sort_order`,
        isStarterSlot: sql`excluded.is_starter_slot`,
      },
    });

  await client.end();
  console.log(`Seeded ${seedPositionsRows.length} positions (offense + IDP + team DEF).`);
}

seedPositions().catch((error) => {
  console.error(error);
  process.exit(1);
});
