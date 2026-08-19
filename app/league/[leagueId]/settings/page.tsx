import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { LeagueSettings } from "@/components/leagues/league-settings";
import { teams } from "@/db/schema";
import { formatPersonName } from "@/lib/account/person-name";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  getLeagueHomeData,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";
import { getNflState } from "@/lib/sleeper/api";
import { resolveDynastySettings } from "@/lib/leagues/dynasty-settings";
import { processDueKeeperDeadline } from "@/lib/leagues/keepers/process";
import { isRegularSeasonFinishedByNfl } from "@/lib/leagues/season-calendar";
import {
  getNonKeeperClearancePreview,
  listKeeperTeamOptions,
} from "@/lib/queries/keepers";

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
      isRegularSeasonFinishedByNfl(
        season.seasonYear,
        season.regularSeasonEndWeek,
        nfl,
      ),
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
      displayName: formatPersonName(member),
      teamName: member.teamName?.trim() || "Unnamed team",
      teamId: member.teamId,
      role: member.role as "commissioner" | "co_commissioner" | "member",
    }))
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName));

  const isDynasty = season?.leagueType === "dynasty";
  const deadline = isDynasty
    ? await processDueKeeperDeadline(slug)
    : { dynasty: null };
  const dynasty =
    deadline.dynasty ??
    (isDynasty && season
      ? resolveDynastySettings(season.settings.dynasty)
      : null);
  const [keeperTeams, clearanceTeams, seasonTeams] = await Promise.all([
    isDynasty && season
      ? listKeeperTeamOptions(season.id)
      : Promise.resolve([]),
    isDynasty && season
      ? getNonKeeperClearancePreview(season.id)
      : Promise.resolve([]),
    season
      ? db
          .select({ userId: teams.userId })
          .from(teams)
          .where(eq(teams.leagueSeasonId, season.id))
      : Promise.resolve([]),
  ]);

  const openTeamSlots = seasonTeams.filter((team) => !team.userId).length;
  const missingTeamRows = season
    ? Math.max(0, season.teamCount - seasonTeams.length)
    : 0;
  const vacantSlotCount = openTeamSlots + missingTeamRows;

  return (
    <LeagueSettings
      league={data.league}
      season={season}
      memberCount={memberCount}
      vacantSlotCount={vacantSlotCount}
      regularSeasonFinished={regularSeasonFinished}
      boxScoresEditable={boxScoresEditable}
      owners={owners}
      keeperTeams={keeperTeams}
      clearanceTeams={clearanceTeams}
      keepersLocked={dynasty?.keepersLocked ?? false}
      keepersMaxConfigured={dynasty?.keepersMax != null}
    />
  );
}
