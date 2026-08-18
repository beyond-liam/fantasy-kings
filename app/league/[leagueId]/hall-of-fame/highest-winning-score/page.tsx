import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HofTitlePageHeader } from "@/components/leagues/hall-of-fame/hof-title-lists";
import { HofWinningScoreHistoryTable } from "@/components/leagues/hall-of-fame/hof-winning-score-history";
import { getSessionUser } from "@/lib/auth/session";
import { loadHofHighestWinningScoreHistory } from "@/lib/queries/hof-winning-score-history";

type PageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ year?: string }>;
};

export const metadata: Metadata = {
  title: "Highest score",
};

function parseYear(value: string | undefined): number | null {
  if (!value) return null;
  const year = Number(value);
  return Number.isInteger(year) ? year : null;
}

export default async function HofHighestWinningScorePage({
  params,
  searchParams,
}: PageProps) {
  const [{ leagueId: slug }, query] = await Promise.all([params, searchParams]);
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/hall-of-fame/highest-winning-score`);
  }

  const data = await loadHofHighestWinningScoreHistory({
    leagueSlug: slug,
    userId: user.id,
    seasonYear: parseYear(query.year),
  });
  if (!data) {
    redirect("/leagues");
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <HofTitlePageHeader
        title="Highest Score"
        leagueSlug={data.leagueSlug}
        description="Top single-game scores across league history."
      />
      <HofWinningScoreHistoryTable
        leagueSlug={data.leagueSlug}
        years={data.availableYears}
        selectedYear={data.selectedYear}
        rows={data.rows}
      />
    </div>
  );
}
