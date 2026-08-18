import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HofTeamCountHistoryTable } from "@/components/leagues/hall-of-fame/hof-team-count-history";
import { HofTitlePageHeader } from "@/components/leagues/hall-of-fame/hof-title-lists";
import { getSessionUser } from "@/lib/auth/session";
import { loadHofCountHistory } from "@/lib/queries/hof-winning-score-history";

type PageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ year?: string }>;
};

export const metadata: Metadata = {
  title: "Fergie Time",
};

function parseYear(value: string | undefined): number | null {
  if (!value) return null;
  const year = Number(value);
  return Number.isInteger(year) ? year : null;
}

export default async function HofFergieTimePage({
  params,
  searchParams,
}: PageProps) {
  const [{ leagueId: slug }, query] = await Promise.all([params, searchParams]);
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/hall-of-fame/fergie-time`);
  }

  const data = await loadHofCountHistory({
    leagueSlug: slug,
    userId: user.id,
    seasonYear: parseYear(query.year),
    kind: "fergie",
  });
  if (!data) {
    redirect("/leagues");
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <HofTitlePageHeader
        title="Fergie Time"
        leagueSlug={data.leagueSlug}
        description="Most late-game comebacks across league history."
      />
      <HofTeamCountHistoryTable
        leagueSlug={data.leagueSlug}
        years={data.availableYears}
        selectedYear={data.selectedYear}
        rows={data.rows}
        emptyTitle="No comebacks yet"
        emptyDescription="Late comebacks will show here once final scores are in."
        countLabel="Comebacks"
      />
    </div>
  );
}
