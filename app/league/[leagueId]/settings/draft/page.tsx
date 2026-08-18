import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { settingsHref } from "@/lib/leagues/settings-tabs";

import { DraftConfigSettings } from "@/components/leagues/draft/draft-config-settings";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getDraftRounds } from "@/lib/leagues/draft/board";
import { toDraftConfigFormValues } from "@/lib/leagues/draft-settings";
import {
  isDynastyStartupSeason,
  maxConfigurableDynastyDraftRounds,
  resolveDynastySettings,
} from "@/lib/leagues/dynasty-settings";
import {
  getLeagueHomeData,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";

type DraftConfigSettingsPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Configure Draft",
};

export default async function DraftConfigSettingsPage({
  params,
}: DraftConfigSettingsPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/settings/draft`);
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
    redirect(settingsHref(slug, "draft"));
  }

  const season = data.season;
  const dynasty =
    season.leagueType === "dynasty"
      ? resolveDynastySettings(season.settings.dynasty)
      : null;
  const rosterCap = getDraftRounds(
    season.settings.rosterSlots,
    season.benchSlots,
  );
  const isStartup = dynasty ? isDynastyStartupSeason(dynasty) : true;
  const maxRounds = dynasty
    ? maxConfigurableDynastyDraftRounds({
        rosterCap,
        keepersMax: dynasty.keepersMax,
        isStartup,
      })
    : rosterCap;
  const storedRounds = season.settings.draft?.rounds;
  const rounds =
    storedRounds != null && Number.isFinite(storedRounds)
      ? Math.min(Math.max(0, Math.trunc(storedRounds)), maxRounds)
      : maxRounds;
  const initialValues = toDraftConfigFormValues({
    draftType: season.draftType,
    draftStartAt: season.draftStartAt,
    pickTimeLimitSeconds: season.pickTimeLimitSeconds,
    draft: season.settings.draft,
    dynastyDraft: dynasty
      ? {
          rounds,
          draftPlayerPool: dynasty.draftPlayerPool,
        }
      : null,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit px-2"
          render={<Link href={settingsHref(slug, "draft")} />}
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Back to Settings
        </Button>
      </div>

      <DraftConfigSettings
        slug={slug}
        leagueName={data.league.name}
        initialValues={initialValues}
        dynasty={
          dynasty
            ? {
                isStartup,
                maxRounds,
                rosterCap,
                keepersMax: dynasty.keepersMax,
              }
            : null
        }
      />
    </div>
  );
}
