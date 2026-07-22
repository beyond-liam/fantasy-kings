import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { InviteLinkCard } from "@/components/leagues/invite-link-card";
import { DraftUnderwayAlert } from "@/components/leagues/draft/draft-underway-alert";
import { LeagueHomeTabs } from "@/components/leagues/league-home-tabs";
import { LeagueStandingsTable } from "@/components/leagues/standings/standings-table";
import { LeagueStatsTable } from "@/components/leagues/stats/league-stats-table";
import { LeaguePlayoffsSection } from "@/components/leagues/playoffs/league-playoffs-section";
import { LeagueRulesSummary } from "@/components/leagues/rules/league-rules-summary";
import { LeagueScoringSummary } from "@/components/leagues/scoring/league-scoring-summary";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { getSessionUser } from "@/lib/auth/session";
import {
  buildLeagueStandings,
} from "@/lib/leagues/standings-from-matchups";
import { teamInitials } from "@/lib/leagues/standings";
import { getFinalMatchupsForSeason } from "@/lib/leagues/matchups/finalize";
import { formatLeagueLabel } from "@/lib/leagues/format";
import {
  bracketTeamsFromStandings,
  buildPlayoffBracket,
} from "@/lib/leagues/playoff-bracket";
import {
  buildPlayoffStandingsRows,
  resolvePlayoffCutoffSeed,
} from "@/lib/leagues/playoff-standings";
import {
  clampPlayoffTeamCount,
  resolvePlayoffSettings,
} from "@/lib/leagues/playoff-settings";
import { getLeagueHomeData, isDraftUnderway } from "@/lib/queries/leagues";
import { getLeaguePositionStats } from "@/lib/queries/league-stats";

type LeagueHomePageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "League",
};

export default async function LeagueHomePage({ params }: LeagueHomePageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}`);
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <Empty className="border-none">
          <EmptyHeader>
            <EmptyTitle>League not found</EmptyTitle>
            <EmptyDescription>
              This league doesn&apos;t exist or you don&apos;t have access.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/leagues" />}>
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Back to Leagues
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (!data.isMember) {
    redirect("/leagues");
  }

  const statsPromise = getLeaguePositionStats(slug, user.id);

  const { league, season, members, draftStatus, standingsTeams } = data;
  const claimedCount = standingsTeams.filter((team) => team.userId).length;
  const isFull = season != null && claimedCount >= season.teamCount;
  const draftUnderway = isDraftUnderway(draftStatus);
  const showFaabBudget =
    Boolean(season?.waiversEnabled) &&
    season?.waiverType === "faab" &&
    season.faabBudget != null &&
    season.faabBudget > 0;
  const finals =
    season != null
      ? await getFinalMatchupsForSeason(season.id).catch(() => [])
      : [];
  const standings = buildLeagueStandings(
    standingsTeams,
    {
      teamCount: season?.teamCount ?? members.length,
      faabBudget: showFaabBudget ? season.faabBudget : null,
    },
    finals,
  );
  const playoffSettings = resolvePlayoffSettings(season?.settings.playoffs);
  const playoffTeamCount =
    season != null
      ? clampPlayoffTeamCount(season.playoffTeamCount, season.teamCount)
      : 0;
  const playoffCutoffSeed = resolvePlayoffCutoffSeed({
    enabled: playoffSettings.enabled,
    playoffTeamCount,
    teamCount: standings.length,
  });
  const playoffStandings = buildPlayoffStandingsRows(standings);
  const playoffBracket =
    season && playoffSettings.enabled
      ? buildPlayoffBracket({
          teams: bracketTeamsFromStandings(
            playoffStandings,
            playoffTeamCount,
          ),
          playoffTeamCount,
          championshipWeek: season.championshipWeek,
          twoWeekChampionship: playoffSettings.twoWeekChampionship,
          enabled: true,
        })
      : null;
  const myTeamPublicId =
    members.find((member) => member.userId === user.id)?.teamPublicId ?? null;
  const stats = await statsPromise;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Avatar size="lg" className="shrink-0">
          {season?.settings.logoUrl ? (
            <AvatarImage src={season.settings.logoUrl} alt="" />
          ) : null}
          <AvatarFallback>{teamInitials(league.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {league.name}
          </h1>
          <p className="text-sm text-pretty text-muted-foreground">
            {formatLeagueLabel(season?.leagueType ?? "redraft")}
          </p>
        </div>
      </div>

      {draftUnderway ? (
        <DraftUnderwayAlert
          slug={league.publicId}
          paused={draftStatus === "paused"}
        />
      ) : null}

      {!isFull ? <InviteLinkCard inviteCode={league.inviteCode} /> : null}

      <LeagueHomeTabs
        standings={
          <LeagueStandingsTable
            rows={standings}
            showFaabBudget={showFaabBudget}
            leagueSlug={league.publicId}
            myTeamSlug={myTeamPublicId}
          />
        }
        stats={
          stats ? (
            <LeagueStatsTable
              rows={stats.rows}
              positionColumns={stats.positionColumns}
              leagueSlug={league.publicId}
              myTeamPublicId={myTeamPublicId}
              week={stats.week}
              scoresAvailable={stats.scoresAvailable}
            />
          ) : undefined
        }
        playoffs={
          <LeaguePlayoffsSection
            rows={playoffStandings}
            showFaabBudget={showFaabBudget}
            leagueSlug={league.publicId}
            myTeamPublicId={myTeamPublicId}
            playoffCutoffSeed={playoffCutoffSeed}
            bracket={playoffBracket}
          />
        }
        rules={
          season ? (
            <LeagueRulesSummary
              season={{
                playoffTeamCount: season.playoffTeamCount,
                championshipWeek: season.championshipWeek,
                regularSeasonEndWeek: season.regularSeasonEndWeek,
                rosterMode: season.rosterMode,
                benchSlots: season.benchSlots,
                irEnabled: season.irEnabled,
                irSlots: season.irSlots,
                taxiEnabled: season.taxiEnabled,
                taxiSlots: season.taxiSlots,
                waiversEnabled: season.waiversEnabled,
                waiverType: season.waiverType,
                faabBudget: season.faabBudget,
                tradesEnabled: season.tradesEnabled,
                tradeProcessing: season.tradeProcessing,
                tradeDeadlineWeek: season.tradeDeadlineWeek,
                draftType: season.draftType,
                draftStartAt: season.draftStartAt,
                pickTimeLimitSeconds: season.pickTimeLimitSeconds,
                settings: season.settings,
              }}
            />
          ) : undefined
        }
        scoring={
          season ? (
            <LeagueScoringSummary
              scoringPreset={season.scoringPreset}
              scoringRules={season.settings.scoringRules}
            />
          ) : undefined
        }
      />
    </div>
  );
}
