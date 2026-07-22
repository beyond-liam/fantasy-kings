import postgres from "postgres";

export function createSeedClient() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL must be set in .env.local");
  }

  return postgres(connectionString, {
    max: 1,
    prepare: false,
    ssl: "require",
  });
}
