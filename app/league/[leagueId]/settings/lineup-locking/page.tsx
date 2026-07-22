import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { settingsHref } from "@/lib/leagues/settings-tabs";

import { LineupLockSettings } from "@/components/leagues/lineup-lock/lineup-lock-settings";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { parseLineupLockMode } from "@/lib/leagues/lineup-lock";
import {
  getLeagueHomeData,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";

type LineupLockSettingsPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Lineup locking",
};

export default async function LineupLockSettingsPage({
  params,
}: LineupLockSettingsPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/settings/lineup-locking`);
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

  const initialMode = parseLineupLockMode(data.season.settings.lineupLockMode);

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

      <LineupLockSettings
        slug={slug}
        leagueName={data.league.name}
        seasonStatus={data.season.status}
        initialMode={initialMode}
      />
    </div>
  );
}
