import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { settingsHref } from "@/lib/leagues/settings-tabs";

import { CoCommissionerSettings } from "@/components/leagues/settings/co-commissioner-settings";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import {
  getLeagueHomeData,
  isPrimaryCommissioner,
} from "@/lib/queries/leagues";

type CoCommissionersPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Co-commissioners",
};

export default async function CoCommissionersPage({
  params,
}: CoCommissionersPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/settings/co-commissioners`);
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data || !data.isMember) {
    redirect("/leagues");
  }

  const isPrimary = await isPrimaryCommissioner(data.league.id, user.id);
  if (!isPrimary) {
    redirect(settingsHref(slug, "league"));
  }

  const owners = data.members
    .map((member) => ({
      userId: member.userId,
      displayName: member.displayName?.trim() || "Manager",
      teamName: member.teamName?.trim() || "Unnamed team",
      teamId: member.teamId,
      role: member.role as "commissioner" | "co_commissioner" | "member",
    }))
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName));

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

      <CoCommissionerSettings slug={slug} owners={owners} />
    </div>
  );
}
