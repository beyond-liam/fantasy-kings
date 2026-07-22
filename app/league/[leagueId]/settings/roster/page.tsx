import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { settingsHref } from "@/lib/leagues/settings-tabs";

import { RosterSettings } from "@/components/leagues/roster/roster-settings";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import {
  starterSlotsFromSettings,
  type RosterMode,
  type RosterRequirementsValues,
} from "@/lib/leagues/roster";
import { resolveIrEligibleStatuses } from "@/lib/leagues/ir-eligibility";
import {
  getLeagueHomeData,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";

type RosterSettingsPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Roster settings",
};

export default async function RosterSettingsPage({
  params,
}: RosterSettingsPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/settings/roster`);
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data) {
    redirect("/leagues");
  }

  if (!data.isMember) {
    redirect("/leagues");
  }

  const isCommissioner = await isLeagueCommissioner(data.league.id, user.id);
  if (!isCommissioner) {
    redirect(`/league/${slug}`);
  }

  if (!data.season) {
    redirect(settingsHref(slug, "rules"));
  }

  const season = data.season;
  const rosterMode = season.rosterMode as RosterMode;
  const initialValues: RosterRequirementsValues = {
    rosterMode,
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    irSlots: Math.max(season.irSlots, 1),
    irEligibleStatuses: resolveIrEligibleStatuses(
      season.settings.irEligibleStatuses,
    ),
    taxiEnabled: season.taxiEnabled,
    taxiSlots: Math.max(season.taxiSlots, 1),
    customRosterSlots: starterSlotsFromSettings(season.settings.rosterSlots),
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit px-2"
          render={<Link href={settingsHref(slug, "rules")} />}
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Back to Settings
        </Button>
      </div>

      <RosterSettings
        slug={slug}
        leagueName={data.league.name}
        seasonStatus={season.status}
        initialValues={initialValues}
      />
    </div>
  );
}
