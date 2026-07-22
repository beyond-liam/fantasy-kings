import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { positions } from "../schema/positions";
import { createSeedClient } from "./client";

dotenv.config({ path: ".env.local" });

const offensePositions = [
  { id: "QB", name: "Quarterback", side: "offense" as const, sortOrder: 1, isStarterSlot: true },
  { id: "RB", name: "Running Back", side: "offense" as const, sortOrder: 2, isStarterSlot: true },
  { id: "WR", name: "Wide Receiver", side: "offense" as const, sortOrder: 3, isStarterSlot: true },
  { id: "TE", name: "Tight End", side: "offense" as const, sortOrder: 4, isStarterSlot: true },
  { id: "FLEX", name: "Flex", side: "flex" as const, sortOrder: 5, isStarterSlot: true },
  { id: "K", name: "Kicker", side: "special" as const, sortOrder: 6, isStarterSlot: true },
  { id: "DEF", name: "Defense", side: "defense" as const, sortOrder: 7, isStarterSlot: true },
  { id: "BN", name: "Bench", side: "offense" as const, sortOrder: 8, isStarterSlot: false },
  { id: "IR", name: "Injured Reserve", side: "offense" as const, sortOrder: 9, isStarterSlot: false },
  { id: "TAXI", name: "Taxi", side: "offense" as const, sortOrder: 10, isStarterSlot: false },
];

async function seedPositions() {
  const client = createSeedClient();
  const db = drizzle(client);

  await db
    .insert(positions)
    .values(offensePositions)
    .onConflictDoNothing();

  await client.end();
  console.log(`Seeded ${offensePositions.length} offense positions.`);
}

seedPositions().catch((error) => {
  console.error(error);
  process.exit(1);
});
