import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

import { leagueSeasons } from "../schema/league-seasons";
import {
  getDefaultScoringRuleDefinitions,
  type ScoringPreset,
} from "../../lib/leagues/scoring";
import { createSeedClient } from "./client";

dotenv.config({ path: ".env.local" });

async function resetScoringRules() {
  const client = createSeedClient();
  const db = drizzle(client);

  const seasons = await db
    .select({
      id: leagueSeasons.id,
      scoringPreset: leagueSeasons.scoringPreset,
      settings: leagueSeasons.settings,
    })
    .from(leagueSeasons);

  for (const season of seasons) {
    const scoringPreset = season.scoringPreset as ScoringPreset;
    const scoringRules = getDefaultScoringRuleDefinitions(scoringPreset);

    await db
      .update(leagueSeasons)
      .set({
        settings: {
          ...season.settings,
          scoringRules,
        },
      })
      .where(eq(leagueSeasons.id, season.id));
  }

  await client.end();
  console.log(
    `Reset scoring rules to preset defaults for ${seasons.length} season(s).`,
  );
}

resetScoringRules().catch((error) => {
  console.error(error);
  process.exit(1);
});
