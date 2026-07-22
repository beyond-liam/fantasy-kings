import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { asc, eq } from "drizzle-orm";
import { settingsHref } from "@/lib/leagues/settings-tabs";

import { StartingLineupsSettings } from "@/components/leagues/settings/starting-lineups-settings";
import { Button } from "@/components/ui/button";
import { teams } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  getLeagueHomeData,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";
import { getTeamRosterPlayers } from "@/lib/queries/team-roster";

type StartingLineupsPageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ team?: string }>;
};

export const metadata: Metadata = {
  title: "Lineups",
};

export default async function StartingLineupsPage({
  params,
  searchParams,
}: StartingLineupsPageProps) {
  const { leagueId: slug } = await params;
  const { team: teamParam } = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/settings/lineups`);
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

  const season = data.season;
  const seasonTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
    })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id))
    .orderBy(asc(teams.name));

  const selectedTeamId =
    (teamParam && seasonTeams.some((team) => team.id === teamParam)
      ? teamParam
      : seasonTeams[0]?.id) ?? "";

  const players = selectedTeamId
    ? await getTeamRosterPlayers(selectedTeamId)
    : [];

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

      <StartingLineupsSettings
        slug={slug}
        leagueName={data.league.name}
        teams={seasonTeams}
        selectedTeamId={selectedTeamId}
        rosterSlots={season.settings.rosterSlots}
        benchSlots={season.benchSlots}
        irEnabled={season.irEnabled}
        irSlots={season.irSlots}
        irEligibleStatuses={season.settings.irEligibleStatuses}
        taxiEnabled={season.taxiEnabled}
        taxiSlots={season.taxiSlots}
        players={players}
      />
    </div>
  );
}
