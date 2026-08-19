import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { CommishEditRoster } from "@/components/leagues/dynasty/commish-edit-roster";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { resolveFantasyMatchupWeek } from "@/lib/leagues/matchup-week";
import { settingsHref } from "@/lib/leagues/settings-tabs";
import {
  getLeagueHomeData,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";
import { listKeeperTeamOptions } from "@/lib/queries/keepers";
import {
  ensureTeamRosterSlotsAssignedForWeek,
  getTeamRosterPlayers,
} from "@/lib/queries/team-roster";

type CommishEditRosterPageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ team?: string }>;
};

export const metadata: Metadata = {
  title: "Edit Rosters",
};

export default async function CommishEditRosterPage({
  params,
  searchParams,
}: CommishEditRosterPageProps) {
  const { leagueId: slug } = await params;
  const { team: teamParam } = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/settings/edit-roster`);
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data || !data.isMember) {
    redirect("/leagues");
  }

  const isCommissioner = await isLeagueCommissioner(data.league.id, user.id);
  if (!isCommissioner) {
    redirect(`/league/${slug}`);
  }

  if (!data.season || data.season.leagueType !== "dynasty") {
    redirect(settingsHref(slug, "commish"));
  }

  const season = data.season;
  const { currentWeek } = await resolveFantasyMatchupWeek({
    seasonYear: season.seasonYear,
    nflRegularSeasonEndWeek: season.regularSeasonEndWeek,
    schedule: season.settings.schedule,
  });
  const teams = await listKeeperTeamOptions(season.id);
  const selectedTeamId =
    (teamParam && teams.some((team) => team.teamId === teamParam)
      ? teamParam
      : teams[0]?.teamId) ?? "";

  if (selectedTeamId) {
    await ensureTeamRosterSlotsAssignedForWeek({
      teamId: selectedTeamId,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
      irEnabled: season.irEnabled,
      taxiEnabled: season.taxiEnabled,
      leagueSeasonId: season.id,
      currentWeek,
    });
  }

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

      <CommishEditRoster
        slug={slug}
        seasonYear={season.seasonYear}
        teams={teams}
        selectedTeamId={selectedTeamId}
        players={players}
      />
    </div>
  );
}
