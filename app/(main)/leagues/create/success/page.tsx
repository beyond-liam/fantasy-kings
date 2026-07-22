import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { CreateSuccessInvite } from "@/components/leagues/create-success-invite";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireSessionUser } from "@/lib/auth/session";
import { getLeagueInviteForCommissioner } from "@/lib/queries/leagues";

type PageProps = {
  searchParams: Promise<{ league?: string; slug?: string }>;
};

function MissingDetails() {
  return (
    <Empty className="border-none">
      <EmptyHeader>
        <EmptyTitle>Missing league details</EmptyTitle>
        <EmptyDescription>
          Head back to leagues and try creating again.
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
  );
}

export const metadata: Metadata = {
  title: "League created",
};

export default async function CreateLeagueSuccessPage({
  searchParams,
}: PageProps) {
  const { league, slug } = await searchParams;
  const idOrSlug = league ?? slug;

  if (!idOrSlug) {
    return <MissingDetails />;
  }

  const user = await requireSessionUser();
  const invite = await getLeagueInviteForCommissioner(idOrSlug, user.id);

  if (!invite) {
    return <MissingDetails />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-8 text-center">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">League created</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          You&apos;re ready to recruit managers
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Share your invite link so friends can join instantly.
        </p>
      </div>
      <CreateSuccessInvite
        inviteCode={invite.inviteCode}
        leagueId={invite.publicId}
      />
    </div>
  );
}
