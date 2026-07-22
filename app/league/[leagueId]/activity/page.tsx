import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LeagueActivityFeed } from "@/components/leagues/activity/league-activity-feed";
import { getSessionUser } from "@/lib/auth/session";
import { getLeagueActivity } from "@/lib/queries/activity";
import { getLeagueHomeData } from "@/lib/queries/leagues";

type ActivityPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Activity",
};

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/activity`);
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data || !data.isMember) {
    redirect("/leagues");
  }

  const season = data.season;
  if (!season) {
    redirect(`/league/${slug}`);
  }

  const items = await getLeagueActivity(season.id);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <LeagueActivityFeed items={items} />
    </div>
  );
}
