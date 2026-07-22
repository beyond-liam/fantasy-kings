import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { count, eq } from "drizzle-orm";
import { settingsHref } from "@/lib/leagues/settings-tabs";

import { ScheduleSettingsForm } from "@/components/leagues/schedule/schedule-settings-form";
import { Button } from "@/components/ui/button";
import { matchups, teams } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { resolveScheduleSettings } from "@/lib/leagues/schedule/settings";
import { isScheduleEditable } from "@/lib/leagues/season-calendar";
import {
  getLeagueHomeData,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";
import { getNflState } from "@/lib/sleeper/api";

type ScheduleSettingsPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Schedule",
};

export default async function ScheduleSettingsPage({
  params,
}: ScheduleSettingsPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/settings/schedule`);
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data || !data.isMember || !data.season) {
    redirect("/leagues");
  }

  const isCommissioner = await isLeagueCommissioner(data.league.id, user.id);
  if (!isCommissioner) {
    redirect(`/league/${slug}`);
  }

  const season = data.season;
  const [teamCountRow] = await db
    .select({ value: count() })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id));
  const [matchupCountRow] = await db
    .select({ value: count() })
    .from(matchups)
    .where(eq(matchups.leagueSeasonId, season.id));

  const filledTeams = Number(teamCountRow?.value ?? 0);
  const schedule = resolveScheduleSettings(season.settings.schedule);
  const nfl = await getNflState();
  const editable = isScheduleEditable(season.seasonYear, nfl);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <Button
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit px-2"
        render={<Link href={settingsHref(slug, "schedule")} />}
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Back to Settings
      </Button>

      <ScheduleSettingsForm
        slug={slug}
        leagueName={data.league.name}
        seasonStatus={season.status}
        divisionCount={season.divisionCount}
        teamCount={season.teamCount}
        regularSeasonEndWeek={season.regularSeasonEndWeek}
        initialPlayEachOtherTimes={schedule.playEachOtherTimes}
        isLeagueFull={filledTeams >= season.teamCount}
        matchupCount={Number(matchupCountRow?.value ?? 0)}
        editable={editable}
      />
    </div>
  );
}
