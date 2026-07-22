import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft01Icon,
  Link01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { LeagueStandingsTable } from "@/components/leagues/standings/standings-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getSessionUser } from "@/lib/auth/session";
import { buildPlaceholderStandings } from "@/lib/leagues/standings";
import { formatLeagueLabel } from "@/lib/leagues/format";
import { getJoinPreview, isLeagueMember } from "@/lib/queries/leagues";
import { getProfileByUserId } from "@/lib/queries/profile";

type JoinPageProps = {
  params: Promise<{ inviteCode: string }>;
};

export const metadata: Metadata = {
  title: "Join league",
};

export default async function JoinLeaguePage({ params }: JoinPageProps) {
  const { inviteCode } = await params;
  const preview = await getJoinPreview(inviteCode);

  if (!preview) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>Invite not found</EmptyTitle>
            <EmptyDescription>
              Double-check your invite link or ask your commissioner for a new
              one.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/leagues" />}>
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Back to leagues
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const user = await getSessionUser();
  if (user) {
    const member = await isLeagueMember(preview.league.id, user.id);
    if (member) {
      redirect(`/league/${preview.league.publicId}`);
    }
  }

  const showFaabBudget =
    Boolean(preview.season?.waiversEnabled) &&
    preview.season?.waiverType === "faab" &&
    preview.season.faabBudget != null &&
    preview.season.faabBudget > 0;

  const standings = buildPlaceholderStandings(preview.standingsTeams, {
    teamCount: preview.season?.teamCount ?? preview.memberCount,
    faabBudget: showFaabBudget ? preview.season!.faabBudget : null,
  });

  const profile = user ? await getProfileByUserId(user.id) : null;
  const canClaim =
    Boolean(user) &&
    Boolean(profile?.onboardedAt) &&
    preview.acceptingMembers &&
    preview.memberCount < (preview.season?.teamCount ?? 0);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">You&apos;re invited to</p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {preview.league.name}
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {formatLeagueLabel(preview.season?.leagueType ?? "redraft")} ·
          Commissioner: {preview.commissionerName}
        </p>
      </div>

      {!preview.acceptingMembers ? (
        <Alert variant="destructive">
          <AlertTitle>Not accepting members</AlertTitle>
          <AlertDescription>
            This league is no longer open to new managers.
          </AlertDescription>
        </Alert>
      ) : null}

      {preview.acceptingMembers &&
      preview.memberCount >= (preview.season?.teamCount ?? 0) ? (
        <Alert variant="destructive">
          <AlertTitle>League full</AlertTitle>
          <AlertDescription>This league has no open spots.</AlertDescription>
        </Alert>
      ) : null}

      {!user ? (
        <Alert>
          <AlertTitle>Sign in to claim a team</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              Create an account or sign in with your email to claim an open
              team.
            </span>
            <Button
              className="w-fit"
              nativeButton={false}
              render={
                <Link
                  href={`/login?next=${encodeURIComponent(`/join/${preview.league.inviteCode}`)}`}
                />
              }
            >
              <HugeiconsIcon
                icon={UserIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Sign in to claim
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <LeagueStandingsTable
        rows={standings}
        showFaabBudget={showFaabBudget}
        leagueSlug={preview.league.publicId}
        inviteCode={preview.league.inviteCode}
        canClaim={canClaim}
      />
    </div>
  );
}
