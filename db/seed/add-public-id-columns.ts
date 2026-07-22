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
  const sql = postgres(url, { prepare: false, ssl: "require" });

  await sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS public_id text`;
  await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS public_id text`;

  const leagueRows = await sql<{ id: string; public_id: string | null }[]>`
    SELECT id, public_id FROM leagues WHERE public_id IS NULL OR public_id = ''
  `;
  const usedLeagueIds = new Set(
    (
      await sql<{ public_id: string }[]>`
        SELECT public_id FROM leagues WHERE public_id IS NOT NULL AND public_id <> ''
      `
    ).map((row) => row.public_id),
  );

  for (const row of leagueRows) {
    let publicId = generatePublicId();
    while (usedLeagueIds.has(publicId)) {
      publicId = generatePublicId();
    }
    usedLeagueIds.add(publicId);
    await sql`UPDATE leagues SET public_id = ${publicId} WHERE id = ${row.id}`;
  }

  const teamRows = await sql<
    { id: string; league_season_id: string; public_id: string | null }[]
  >`
    SELECT id, league_season_id, public_id FROM teams
    WHERE public_id IS NULL OR public_id = ''
  `;

  for (const row of teamRows) {
    const used = new Set(
      (
        await sql<{ public_id: string }[]>`
          SELECT public_id FROM teams
          WHERE league_season_id = ${row.league_season_id}
            AND public_id IS NOT NULL AND public_id <> ''
        `
      ).map((r) => r.public_id),
    );
    let publicId = generatePublicId();
    while (used.has(publicId)) {
      publicId = generatePublicId();
    }
    await sql`UPDATE teams SET public_id = ${publicId} WHERE id = ${row.id}`;
  }

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS leagues_public_id_unique
    ON leagues (public_id)
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS teams_season_public_id_idx
    ON teams (league_season_id, public_id)
  `;

  console.log(
    `Backfilled ${leagueRows.length} leagues and ${teamRows.length} teams`,
  );
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
