import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  HofChampionshipsTable,
  HofTitlePageHeader,
} from "@/components/leagues/hall-of-fame/hof-title-lists";
import { getSessionUser } from "@/lib/auth/session";
import { loadHofTitleLists } from "@/lib/queries/hof-title-lists";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Champions",
};

export default async function HofChampionsPage({ params }: PageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/hall-of-fame/champions`);
  }

  const data = await loadHofTitleLists({
    leagueSlug: slug,
    userId: user.id,
  });
  if (!data) {
    redirect("/leagues");
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <HofTitlePageHeader
        title="Champions"
        leagueSlug={data.leagueSlug}
        description="League championship winners by season."
      />
      <HofChampionshipsTable
        leagueSlug={data.leagueSlug}
        rows={data.championships}
      />
    </div>
  );
}
