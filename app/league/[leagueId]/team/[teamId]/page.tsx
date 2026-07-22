import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";

import { TeamDraftPicksList } from "@/components/team/team-draft-picks-list";
import { TeamRosterSections } from "@/components/team/roster-sections";
import { TeamScheduleList } from "@/components/team/team-schedule-list";
import { TeamStatsSections } from "@/components/team/stats-sections";
import { TeamTabs } from "@/components/team/team-tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getSessionUser } from "@/lib/auth/session";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import { ensureSeasonTeamPublicIds } from "@/lib/leagues/ensure-public-ids";
import { myTeamPath } from "@/lib/leagues/utils";
import {
  buildOpponentByTeam,
  resolvePlayerOpponent,
  type TeamMatchup,
} from "@/lib/nfl/matchups";
import { getDraftedRosterForTeam } from "@/lib/queries/draft";
import { getLeagueHomeData } from "@/lib/queries/leagues";
import { getTeamSchedule } from "@/lib/queries/matchups";
import { getRankedPlayers } from "@/lib/queries/players";
import { getPlayerRosterRatesMap } from "@/lib/queries/player-roster-rates";
import { getTeamRosterPlayers } from "@/lib/queries/team-roster";
import { getLeagueTeamByPublicId } from "@/lib/queries/team";
import { getUserTeamForLeague } from "@/lib/queries/watchlist";
import { teamInitials } from "@/lib/leagues/standings";
import { getNflState } from "@/lib/sleeper/api";

type LeagueTeamPageProps = {
  params: Promise<{ leagueId: string; teamId: string }>;
};

export const metadata: Metadata = {
  title: "Team",
};

export default async function LeagueTeamPage({ params }: LeagueTeamPageProps) {
  const { leagueId: slug, teamId } = await params;

  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/team/${teamId}`);
  }

  const [data, myTeam] = await Promise.all([
    getLeagueHomeData(slug, user.id),
    getUserTeamForLeague(slug, user.id),
  ]);

  if (!data || !data.isMember || !data.season) {
    redirect("/leagues");
  }

  // Legacy slug bookmark → canonical public id URL
  if (data.league.publicId !== slug) {
    redirect(`/league/${data.league.publicId}/team/${teamId}`);
  }

  const season = data.season;
  await ensureSeasonTeamPublicIds(season.id);

  const team = await getLeagueTeamByPublicId(season.id, teamId);
  if (!team) {
    notFound();
  }

  if (myTeam?.id === team.id) {
    redirect(myTeamPath(slug));
  }

  const scoringPreset = season.scoringPreset as ScoringPreset;
  const scoringRules = resolveScoringRuleDefinitions(
    scoringPreset,
    season.settings.scoringRules,
  );

  const nflStatePromise = getNflState();

  const [rosterPlayers, scheduleRows, draftPicks, nflState, scoreboard] =
    await Promise.all([
      getTeamRosterPlayers(team.id),
      getTeamSchedule(season.id, team.id),
      getDraftedRosterForTeam(team.id),
      nflStatePromise,
      nflStatePromise
        .then((state) => {
          const week = Math.max(1, Number(state.week) || 1);
          const seasonYear =
            Number(state.season) || new Date().getUTCFullYear();
          return getNflScoreboard({ season: seasonYear, week });
        })
        .catch(() => null),
    ]);

  const rosterPlayerIds = rosterPlayers.map((player) => player.id);
  const nflWeek = Math.max(1, Number(nflState.week) || 1);

  let opponentsByTeam = new Map<string, TeamMatchup>();
  if (scoreboard) {
    opponentsByTeam = buildOpponentByTeam(scoreboard.games);
  }

  const withOpponent = <
    T extends { nflTeam: string | null; byeWeek: number | null },
  >(
    player: T,
  ): T & { opponent: ReturnType<typeof resolvePlayerOpponent> } => ({
    ...player,
    opponent: resolvePlayerOpponent({
      nflTeam: player.nflTeam,
      byeWeek: player.byeWeek,
      week: nflWeek,
      opponentsByTeam,
    }),
  });

  const [rosterRates, weekProjections, weekStats, seasonProjections] =
    await Promise.all([
      getPlayerRosterRatesMap(rosterPlayerIds),
      rosterPlayerIds.length > 0
        ? getRankedPlayers({
            season: nflState.season,
            week: nflWeek,
            kind: "projection",
            scoringRules,
            playerIds: rosterPlayerIds,
          }).catch(() => [])
        : Promise.resolve([]),
      rosterPlayerIds.length > 0
        ? getRankedPlayers({
            season: nflState.season,
            week: nflWeek,
            kind: "stats",
            scoringRules,
            playerIds: rosterPlayerIds,
          }).catch(() => [])
        : Promise.resolve([]),
      rosterPlayerIds.length > 0
        ? getRankedPlayers({
            season: nflState.season,
            week: 0,
            kind: "projection",
            scoringRules,
            playerIds: rosterPlayerIds,
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

  const projectedById = new Map(
    weekProjections.map((player) => [player.id, player.fantasyPts]),
  );
  const actualById = new Map(
    weekStats.map((player) => [player.id, player.fantasyPts]),
  );

  const rosterPlayersWithRates = rosterPlayers.map((player) => {
    const rates = rosterRates.get(player.id);
    return withOpponent({
      ...player,
      ownedPct: rates?.ownedPct ?? null,
      startPct: rates?.startPct ?? null,
      actualPts: actualById.get(player.id) ?? null,
      projectedPts: projectedById.get(player.id) ?? null,
    });
  });

  const scoredPlayers = seasonProjections.map((player) => withOpponent(player));

  const weekRangeByNumber = new Map(
    (scoreboard?.weeks ?? []).map((week) => [week.number, week.rangeLabel]),
  );
  const scheduleDisplayRows = scheduleRows.map((row) => ({
    ...row,
    weekRangeLabel: weekRangeByNumber.get(row.week) ?? "",
    opponentWins: 0,
    opponentLosses: 0,
    opponentTies: 0,
    result: null as "win" | "loss" | "tie" | null,
    weeklyRank: null as number | null,
    winChance: null as number | null,
  }));

  const draftPickRows = draftPicks.map((pick) => ({
    overall: pick.overall,
    playerName: pick.fullName,
    positionId: pick.primaryPositionId,
    nflTeam: pick.nflTeam,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Avatar size="lg" className="shrink-0">
          {team.logoUrl ? <AvatarImage src={team.logoUrl} alt="" /> : null}
          <AvatarFallback>{teamInitials(team.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {team.name}
          </h1>
          <p className="text-sm text-pretty text-muted-foreground">
            Managed by {team.ownerName?.trim() || "Manager"}
          </p>
        </div>
      </div>

      <TeamTabs
        variant="other"
        roster={
          <TeamRosterSections
            rosterSlots={season.settings.rosterSlots}
            benchSlots={season.benchSlots}
            irEnabled={season.irEnabled}
            irSlots={season.irSlots}
            irEligibleStatuses={season.settings.irEligibleStatuses}
            taxiEnabled={season.taxiEnabled}
            taxiSlots={season.taxiSlots}
            players={rosterPlayersWithRates}
            leagueSlug={slug}
            actionsEnabled={false}
          />
        }
        stats={
          <TeamStatsSections players={scoredPlayers} leagueSlug={slug} />
        }
        schedule={
          <TeamScheduleList
            rows={scheduleDisplayRows}
            leagueSlug={slug}
            myTeamSlug={myTeam?.publicId ?? null}
          />
        }
        draft-picks={<TeamDraftPicksList picks={draftPickRows} />}
      />
    </div>
  );
}
