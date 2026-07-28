import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { Spinner } from "@/components/ui/spinner";
import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";
import { getRankedPlayers } from "@/lib/queries/players";
import { getNflState } from "@/lib/sleeper/api";

export const metadata: Metadata = {
  title: "Mock Draft Live",
};

/** Cap draft pool — full projection table is unnecessary for mock ADP. */
const MOCK_DRAFT_POOL_LIMIT = 400;

const MockDraftRoom = dynamic(
  () =>
    import("@/components/mock-draft/mock-draft-room").then(
      (m) => m.MockDraftRoom,
    ),
  { loading: () => <Spinner className="mx-auto mt-12" /> },
);

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
  const scoringRules = getDefaultScoringRuleDefinitions(scoring);

  const nflState = await getNflState();
  const players = await getRankedPlayers({
    season: nflState.season,
    week: 0,
    kind: "projection",
    scoringPreset: scoring,
    scoringRules,
    limit: MOCK_DRAFT_POOL_LIMIT,
  }).catch(() => []);

  return <MockDraftRoom players={players} />;
}
