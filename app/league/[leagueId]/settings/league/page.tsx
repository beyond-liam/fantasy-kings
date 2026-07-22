import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { asc, eq } from "drizzle-orm";
import { settingsHref } from "@/lib/leagues/settings-tabs";

import { LeagueIdentitySettings } from "@/components/leagues/identity/league-identity-settings";
import { Button } from "@/components/ui/button";
import { divisions } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  getLeagueHomeData,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";

type LeagueIdentityPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "League settings",
};

export default async function LeagueIdentityPage({
  params,
}: LeagueIdentityPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/settings/league`);
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
    redirect(settingsHref(slug, "league"));
  }

  const seasonDivisions = await db
    .select({
      id: divisions.id,
      name: divisions.name,
    })
    .from(divisions)
    .where(eq(divisions.leagueSeasonId, data.season.id))
    .orderBy(asc(divisions.sortOrder));

  const logoUrl = data.season.settings.logoUrl ?? null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
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
      </div>

      <LeagueIdentitySettings
        key={`${data.league.name}|${logoUrl ?? ""}|${seasonDivisions
          .map((division) => `${division.id}:${division.name}`)
          .join("|")}`}
        slug={slug}
        seasonStatus={data.season.status}
        initialLogoUrl={logoUrl}
        initialValues={{
          name: data.league.name,
          logoMode: "keep",
          logoUrl: logoUrl ?? "",
          divisions: seasonDivisions,
        }}
      />
    </div>
  );
}
