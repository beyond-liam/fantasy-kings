import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LENGTH = 6;

function generatePublicId() {
  const bytes = new Uint8Array(LENGTH);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < LENGTH; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return id;
}

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DIRECT_URL / DATABASE_URL missing");
  }
  const sql = postgres(url, { prepare: false, ssl: "require", max: 1 });

  await sql`ALTER TABLE matchups ADD COLUMN IF NOT EXISTS public_id text`;

  const rows = await sql<
    { id: string; league_season_id: string; public_id: string | null }[]
  >`
    SELECT id, league_season_id, public_id FROM matchups
    WHERE public_id IS NULL OR public_id = ''
  `;

  let updated = 0;
  for (const row of rows) {
    const used = new Set(
      (
        await sql<{ public_id: string }[]>`
          SELECT public_id FROM matchups
          WHERE league_season_id = ${row.league_season_id}
            AND public_id IS NOT NULL AND public_id <> ''
        `
      ).map((r) => r.public_id),
    );
    let publicId = generatePublicId();
    while (used.has(publicId)) {
      publicId = generatePublicId();
    }
    await sql`UPDATE matchups SET public_id = ${publicId} WHERE id = ${row.id}`;
    updated += 1;
  }

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS matchups_season_public_id_idx
    ON matchups (league_season_id, public_id)
  `;

  console.log(`Backfilled public_id on ${updated} matchups`);
  await sql.end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
