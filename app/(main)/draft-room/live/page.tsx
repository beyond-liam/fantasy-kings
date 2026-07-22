import type { Metadata } from "next";

import { MockDraftRoom } from "@/components/mock-draft/mock-draft-room";
import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";
import { getRankedPlayers } from "@/lib/queries/players";
import { getNflState } from "@/lib/sleeper/api";

export const metadata: Metadata = {
  title: "Mock Draft Live",
};

function parseScoring(value: string | undefined): ScoringPreset {
  if (value === "standard" || value === "half_ppr" || value === "full_ppr") {
    return value;
  }
  return "full_ppr";
}

type MockDraftLivePageProps = {
  searchParams: Promise<{ scoring?: string }>;
};

export default async function MockDraftLivePage({
  searchParams,
}: MockDraftLivePageProps) {
  const params = await searchParams;
  const scoring = parseScoring(params.scoring);
  const nflState = await getNflState();
  const scoringRules = getDefaultScoringRuleDefinitions(scoring);

  const players = await getRankedPlayers({
    season: nflState.season,
    week: 0,
    kind: "projection",
    scoringPreset: scoring,
    scoringRules,
  }).catch(() => []);

  return <MockDraftRoom players={players} />;
}
