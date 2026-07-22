import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LeagueSettings } from "@/components/leagues/league-settings";
import { getSessionUser } from "@/lib/auth/session";
import {
  getLeagueHomeData,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";
import { getNflState } from "@/lib/sleeper/api";

type LeagueSettingsPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Settings",
};

export default async function LeagueSettingsPage({
  params,
}: LeagueSettingsPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/settings`);
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

  const season = data.season;
  const memberCount = data.members.length;
  const nfl = season ? await getNflState().catch(() => null) : null;
  const regularSeasonFinished = Boolean(
    season &&
      nfl &&
      ((Number(nfl.season) > season.seasonYear &&
        nfl.season_type !== "pre" &&
        nfl.season_type !== "off") ||
        (Number(nfl.season) === season.seasonYear &&
          (nfl.season_type === "post" ||
            nfl.season_type === "playoffs" ||
            (nfl.season_type === "regular" &&
              Number(nfl.week) > season.regularSeasonEndWeek)))),
  );
  const boxScoresEditable = Boolean(
    season &&
      nfl &&
      Number(nfl.season) === season.seasonYear &&
      nfl.season_type === "regular" &&
      Number(nfl.week) >= 1,
  );

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
    <LeagueSettings
      league={data.league}
      season={season}
      memberCount={memberCount}
      regularSeasonFinished={regularSeasonFinished}
      boxScoresEditable={boxScoresEditable}
      owners={owners}
    />
  );
}
