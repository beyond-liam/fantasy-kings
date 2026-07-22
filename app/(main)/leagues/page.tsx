import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Add01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { JoinLeagueDialog } from "@/components/leagues/join-league-dialog";
import { LeaguesTable } from "@/components/leagues/leagues-table";
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
import { getUserLeagues } from "@/lib/queries/leagues";

export const metadata: Metadata = {
  title: "Leagues",
};

export default async function LeaguesPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/leagues");
  }

  const leagues = await getUserLeagues(user.id);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Leagues
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <JoinLeagueDialog />
          <Button nativeButton={false} render={<Link href="/leagues/create" />}>
            <HugeiconsIcon
              icon={Add01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Create League
          </Button>
        </div>
      </div>

      {leagues.length ? (
        <LeaguesTable leagues={leagues} />
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No leagues yet</EmptyTitle>
            <EmptyDescription>
              Create one for your friend group, or join with an invite code.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <JoinLeagueDialog />
              <Button
                nativeButton={false}
                render={<Link href="/leagues/create" />}
              >
                <HugeiconsIcon
                  icon={Add01Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Create League
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}
