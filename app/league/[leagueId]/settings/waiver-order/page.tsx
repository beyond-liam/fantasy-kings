import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { asc, eq } from "drizzle-orm";
import { settingsHref } from "@/lib/leagues/settings-tabs";

import { WaiverOrderSettings } from "@/components/leagues/settings/waiver-order-settings";
import { Button } from "@/components/ui/button";
import { teams } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  getLeagueHomeData,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";

type WaiverOrderSettingsPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Waiver order",
};

export default async function WaiverOrderSettingsPage({
  params,
}: WaiverOrderSettingsPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/settings/waiver-order`);
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data || !data.isMember) {
    redirect("/leagues");
  }

  const isCommissioner = await isLeagueCommissioner(data.league.id, user.id);
  if (!isCommissioner) {
    redirect(`/league/${slug}`);
  }

  if (!data.season) {
    redirect(settingsHref(slug, "commish"));
  }

  const seasonTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      waiverPriority: teams.waiverPriority,
    })
    .from(teams)
    .where(eq(teams.leagueSeasonId, data.season.id))
    .orderBy(asc(teams.waiverPriority), asc(teams.name));

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit px-2"
          render={<Link href={settingsHref(slug, "commish")} />}
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Back to Settings
        </Button>
      </div>

      <WaiverOrderSettings
        slug={slug}
        leagueName={data.league.name}
        waiverType={data.season.waiverType}
        initialTeams={seasonTeams}
      />
    </div>
  );
}
