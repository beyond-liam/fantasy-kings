import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HofDivisionTitlesTable } from "@/components/leagues/hall-of-fame/hof-division-titles-table";
import { HofTitlePageHeader } from "@/components/leagues/hall-of-fame/hof-title-lists";
import { getSessionUser } from "@/lib/auth/session";
import { loadHofTitleLists } from "@/lib/queries/hof-title-lists";

type PageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ division?: string }>;
};

export const metadata: Metadata = {
  title: "Division titles",
};

export default async function HofDivisionTitlesPage({
  params,
  searchParams,
}: PageProps) {
  const { leagueId: slug } = await params;
  const { division: divisionParam } = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/hall-of-fame/division-titles`);
  }

  const data = await loadHofTitleLists({
    leagueSlug: slug,
    userId: user.id,
  });
  if (!data) {
    redirect("/leagues");
  }

  if (!data.multiDivision) {
    redirect(`/league/${data.leagueSlug}/hall-of-fame/regular-season`);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <HofTitlePageHeader
        title="Division titles"
        leagueSlug={data.leagueSlug}
        description="Regular-season division winners by season."
      />
      <HofDivisionTitlesTable
        leagueSlug={data.leagueSlug}
        divisions={data.divisions}
        rows={data.divisionTitles}
        initialDivisionId={divisionParam ?? null}
      />
    </div>
  );
}
