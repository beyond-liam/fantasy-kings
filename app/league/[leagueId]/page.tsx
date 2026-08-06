import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { InviteLinkCard } from "@/components/leagues/invite-link-card";
import { DraftGradeDialogSlot } from "@/components/leagues/draft/draft-grade-dialog-slot";
import { DraftUnderwayAlert } from "@/components/leagues/draft/draft-underway-alert";
import { LeagueHomeHofTab } from "@/components/leagues/home/league-home-hof-tab";
import { LeagueHomeOverviewTab } from "@/components/leagues/home/league-home-overview-tab";
import { LeagueHomePlayoffsTab } from "@/components/leagues/home/league-home-playoffs-tab";
import { LeagueHomePowerRankingsTab } from "@/components/leagues/home/league-home-power-rankings-tab";
import { LeagueHomeStandingsTab } from "@/components/leagues/home/league-home-standings-tab";
import { LeagueHomeStatsTab } from "@/components/leagues/home/league-home-stats-tab";
import { LeagueHomeTabs } from "@/components/leagues/league-home-tabs";
import { LeagueRulesSummary } from "@/components/leagues/rules/league-rules-summary";
import { LeagueScoringSummary } from "@/components/leagues/scoring/league-scoring-summary";
import { PageSkeleton } from "@/components/layout/page-skeleton";
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
import { resolveDraftType } from "@/lib/leagues/draft-settings";
import { formatLeagueLabel } from "@/lib/leagues/format";
import type { ScoringPreset } from "@/lib/leagues/scoring";
import { teamInitials } from "@/lib/leagues/standings";
import { getDraftUnderwayBoard } from "@/lib/queries/draft";
import type { LeagueHomeStandingsBundleInput } from "@/lib/queries/league-home-standings";
import { getLeagueHomeData, isDraftUnderway } from "@/lib/queries/leagues";

type LeagueHomePageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ tab?: string; mock?: string; draftGrade?: string }>;
};

export const metadata: Metadata = {
  title: "League",
};

export default async function LeagueHomePage({
  params,
  searchParams,
}: LeagueHomePageProps) {
  const { leagueId: slug } = await params;
  const { mock, draftGrade } = await searchParams;
  const useOverviewMock =
    process.env.NODE_ENV === "development" && (mock === "1" || mock === "true");
  const previewDraftGrade =
    process.env.NODE_ENV === "development" && Boolean(draftGrade);
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

  const { league, season, members, draftStatus, standingsTeams } = data;
  const claimedCount = standingsTeams.filter((team) => team.userId).length;
  const isFull = season != null && claimedCount >= season.teamCount;
  const draftUnderway = isDraftUnderway(draftStatus);
  const draftType = resolveDraftType(season?.draftType);
  const draftBoard =
    draftUnderway && draftType === "email" && season
      ? await getDraftUnderwayBoard({
          leagueSeasonId: season.id,
          settings: season.settings,
          benchSlots: season.benchSlots,
        })
      : null;
  const showFaabBudget =
    Boolean(season?.waiversEnabled) &&
    season?.waiverType === "faab" &&
    season.faabBudget != null &&
    season.faabBudget > 0;

  const myTeamPublicId =
    members.find((member) => member.userId === user.id)?.teamPublicId ?? null;
  const myMember = members.find((member) => member.userId === user.id);
  const myTeamId = myMember?.teamId ?? null;

  const bundleInput: LeagueHomeStandingsBundleInput = {
    leagueSeasonId: season?.id ?? null,
    standingsTeams,
    teamCount: season?.teamCount ?? members.length,
    showFaabBudget,
    faabBudget: season?.faabBudget ?? null,
    regularSeasonEndWeek: season?.regularSeasonEndWeek ?? 14,
    tiebreakers: season?.settings.tiebreakers,
    seasonYear: season?.seasonYear ?? null,
    scoringPreset: (season?.scoringPreset as ScoringPreset | undefined) ?? null,
    scoringRules: season?.settings.scoringRules,
    rosterSlots: season?.settings.rosterSlots ?? [],
    benchSlots: season?.benchSlots ?? 6,
    irEnabled: season?.irEnabled ?? false,
    irSlots: season?.irSlots ?? 0,
    irEligibleStatuses: season?.settings.irEligibleStatuses,
    taxiEnabled: season?.taxiEnabled ?? false,
    taxiSlots: season?.taxiSlots ?? 0,
    playoffTeamCount: season?.playoffTeamCount ?? 0,
    championshipWeek: season?.championshipWeek ?? 17,
    playoffs: season?.settings.playoffs,
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <Suspense fallback={null}>
        <DraftGradeDialogSlot
          leagueSlug={league.publicId}
          teamId={myTeamId}
          leagueSeasonId={season?.id}
          preview={previewDraftGrade ? (draftGrade ?? true) : undefined}
          teamName={myMember?.teamName}
          teamLogoUrl={
            standingsTeams.find((team) => team.teamId === myTeamId)?.logoUrl
          }
          leagueName={league.name}
        />
      </Suspense>
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
          draftType={draftType}
          board={draftBoard}
        />
      ) : null}

      {!isFull ? <InviteLinkCard inviteCode={league.inviteCode} /> : null}

      <Suspense fallback={null}>
        <LeagueHomeTabs
          overview={
            <Suspense fallback={<PageSkeleton />}>
              <LeagueHomeOverviewTab
                bundleInput={bundleInput}
                leagueSlug={league.publicId}
                userId={user.id}
                myTeamId={myTeamId}
                standingsTeams={standingsTeams}
                useOverviewMock={useOverviewMock}
              />
            </Suspense>
          }
          standings={
            <Suspense fallback={<PageSkeleton />}>
              <LeagueHomeStandingsTab
                bundleInput={bundleInput}
                leagueSlug={league.publicId}
                myTeamPublicId={myTeamPublicId}
                showFaabBudget={showFaabBudget}
              />
            </Suspense>
          }
          powerRankings={
            <Suspense fallback={<PageSkeleton />}>
              <LeagueHomePowerRankingsTab
                leagueSlug={league.publicId}
                leagueSeasonId={season?.id ?? null}
                standingsTeams={standingsTeams}
                seasonYear={season?.seasonYear ?? new Date().getFullYear()}
                championshipWeek={season?.championshipWeek ?? 17}
                settings={season?.settings ?? null}
                scoringPreset={season?.scoringPreset ?? null}
                regularSeasonEndWeek={season?.regularSeasonEndWeek ?? 14}
                playoffTeamCount={season?.playoffTeamCount ?? 0}
              />
            </Suspense>
          }
          stats={
            <Suspense fallback={<PageSkeleton />}>
              <LeagueHomeStatsTab
                leagueSlug={league.publicId}
                userId={user.id}
                myTeamPublicId={myTeamPublicId}
              />
            </Suspense>
          }
          playoffs={
            <Suspense fallback={<PageSkeleton />}>
              <LeagueHomePlayoffsTab
                bundleInput={bundleInput}
                leagueSlug={league.publicId}
                myTeamPublicId={myTeamPublicId}
                showFaabBudget={showFaabBudget}
              />
            </Suspense>
          }
          hallOfFame={
            <Suspense fallback={<PageSkeleton />}>
              <LeagueHomeHofTab
                bundleInput={bundleInput}
                leagueSlug={league.publicId}
                standingsTeams={standingsTeams}
                divisionCount={season?.divisionCount ?? 1}
              />
            </Suspense>
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
      </Suspense>
    </div>
  );
}
