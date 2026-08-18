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
  title: "Luckiest Man Alive",
};

function parseYear(value: string | undefined): number | null {
  if (!value) return null;
  const year = Number(value);
  return Number.isInteger(year) ? year : null;
}

export default async function HofLuckiestManAlivePage({
  params,
  searchParams,
}: PageProps) {
  const [{ leagueId: slug }, query] = await Promise.all([params, searchParams]);
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/hall-of-fame/luckiest-man-alive`);
  }

  const data = await loadHofCountHistory({
    leagueSlug: slug,
    userId: user.id,
    seasonYear: parseYear(query.year),
    kind: "luckiest",
  });
  if (!data) {
    redirect("/leagues");
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <HofTitlePageHeader
        title="Luckiest Man Alive"
        leagueSlug={data.leagueSlug}
        description="Most lucky wins across league history."
      />
      <HofTeamCountHistoryTable
        leagueSlug={data.leagueSlug}
        years={data.availableYears}
        selectedYear={data.selectedYear}
        rows={data.rows}
        emptyTitle="No lucky wins yet"
        emptyDescription="Lucky wins will show here once final scores are in."
        countLabel="Lucky wins"
      />
    </div>
  );
}
