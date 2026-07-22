import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DIRECT_URL or DATABASE_URL must be set");
  }

  const sql = postgres(url, { prepare: false, ssl: "require", max: 1 });

  await sql.unsafe(`
DO $$ BEGIN
  CREATE TYPE matchup_status AS ENUM ('scheduled', 'in_progress', 'final');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
`);

  await sql.unsafe(`
ALTER TABLE matchups
  ADD COLUMN IF NOT EXISTS home_pts double precision,
  ADD COLUMN IF NOT EXISTS away_pts double precision,
  ADD COLUMN IF NOT EXISTS status matchup_status NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
`);

  console.log("matchups result columns applied");
  await sql.end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
