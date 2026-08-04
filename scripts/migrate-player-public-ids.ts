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

  await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS public_id text`;

  const used = new Set(
    (
      await sql<{ public_id: string }[]>`
        SELECT public_id FROM players
        WHERE public_id IS NOT NULL AND public_id <> ''
      `
    ).map((row) => row.public_id),
  );

  const rows = await sql<{ id: string }[]>`
    SELECT id FROM players WHERE public_id IS NULL OR public_id = ''
  `;

  let updated = 0;
  for (const row of rows) {
    let publicId = generatePublicId();
    while (used.has(publicId)) {
      publicId = generatePublicId();
    }
    used.add(publicId);
    await sql`UPDATE players SET public_id = ${publicId} WHERE id = ${row.id}`;
    updated += 1;
  }

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS players_public_id_unique
    ON players (public_id)
  `;

  console.log(`Backfilled public_id on ${updated} players`);
  await sql.end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
