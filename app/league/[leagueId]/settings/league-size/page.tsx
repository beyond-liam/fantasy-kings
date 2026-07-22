import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { asc, count, eq } from "drizzle-orm";
import { settingsHref } from "@/lib/leagues/settings-tabs";

import { LeagueSizeSettings } from "@/components/leagues/settings/league-size-settings";
import { Button } from "@/components/ui/button";
import { divisions, leagueMembers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  getLeagueHomeData,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";

type LeagueSizePageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "League size",
};

export default async function LeagueSizePage({ params }: LeagueSizePageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/settings/league-size`);
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data || !data.isMember || !data.season) {
    redirect("/leagues");
  }

  const isCommissioner = await isLeagueCommissioner(data.league.id, user.id);
  if (!isCommissioner) {
    redirect(`/league/${slug}`);
  }

  const [memberCountRow, seasonDivisions] = await Promise.all([
    db
      .select({ value: count() })
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, data.league.id)),
    db
      .select({
        id: divisions.id,
        name: divisions.name,
      })
      .from(divisions)
      .where(eq(divisions.leagueSeasonId, data.season.id))
      .orderBy(asc(divisions.sortOrder)),
  ]);

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

      <LeagueSizeSettings
        slug={slug}
        teamCount={data.season.teamCount}
        memberCount={Number(memberCountRow[0]?.value ?? data.members.length)}
        divisionCount={data.season.divisionCount}
        divisions={seasonDivisions}
      />
    </div>
  );
}
