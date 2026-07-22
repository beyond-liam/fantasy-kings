import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { asc, eq } from "drizzle-orm";
import { settingsHref } from "@/lib/leagues/settings-tabs";

import { RealignDivisionsSettings } from "@/components/leagues/settings/realign-divisions-settings";
import { Button } from "@/components/ui/button";
import { divisions, teams } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  getLeagueHomeData,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";

type RealignDivisionsPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Realign divisions",
};

export default async function RealignDivisionsPage({
  params,
}: RealignDivisionsPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/settings/realign-divisions`);
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data || !data.isMember || !data.season) {
    redirect("/leagues");
  }

  const isCommissioner = await isLeagueCommissioner(data.league.id, user.id);
  if (!isCommissioner) {
    redirect(`/league/${slug}`);
  }

  if (data.season.divisionCount < 2) {
    redirect(settingsHref(slug, "league"));
  }

  const [seasonDivisions, seasonTeams] = await Promise.all([
    db
      .select({
        id: divisions.id,
        name: divisions.name,
      })
      .from(divisions)
      .where(eq(divisions.leagueSeasonId, data.season.id))
      .orderBy(asc(divisions.sortOrder)),
    db
      .select({
        id: teams.id,
        name: teams.name,
        divisionId: teams.divisionId,
      })
      .from(teams)
      .where(eq(teams.leagueSeasonId, data.season.id))
      .orderBy(asc(teams.name)),
  ]);

  if (seasonDivisions.length < 2) {
    redirect(settingsHref(slug, "league"));
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <Button
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit px-2"
        render={<Link href={settingsHref(slug, "league")} />}
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Back to Settings
      </Button>

      <RealignDivisionsSettings
        slug={slug}
        divisions={seasonDivisions}
        teams={seasonTeams}
      />
    </div>
  );
}
