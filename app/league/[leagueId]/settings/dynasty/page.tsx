import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { DynastySettingsForm } from "@/components/leagues/dynasty/dynasty-settings-form";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import {
  clampDynastyKeepersToRosterCap,
  resolveDynastySettings,
  type DynastyRosterKeeperCap,
} from "@/lib/leagues/dynasty-settings";
import { getMaxRosterSize } from "@/lib/leagues/roster-capacity";
import { settingsHref } from "@/lib/leagues/settings-tabs";
import {
  getLeagueHomeData,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";

type DynastySettingsPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Dynasty Rules",
};

export default async function DynastySettingsPage({
  params,
}: DynastySettingsPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/settings/dynasty`);
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
    redirect(settingsHref(slug, "rules"));
  }

  if (data.season.leagueType !== "dynasty") {
    redirect(settingsHref(slug, "rules"));
  }

  const rosterCap: DynastyRosterKeeperCap = {
    activeRosterSize: getMaxRosterSize(
      data.season.settings.rosterSlots,
      data.season.benchSlots,
    ),
    irSlots: data.season.irEnabled ? data.season.irSlots : 0,
    taxiSlots: data.season.taxiEnabled ? data.season.taxiSlots : 0,
  };
  const initialValues = clampDynastyKeepersToRosterCap(
    resolveDynastySettings(data.season.settings.dynasty),
    rosterCap,
  );

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

      <DynastySettingsForm
        slug={slug}
        initialValues={initialValues}
        rosterCap={rosterCap}
      />
    </div>
  );
}
