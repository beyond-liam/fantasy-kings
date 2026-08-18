import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Add01Icon, LeftToRightListNumberIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { MyLeaguesCarousel } from "@/components/dashboard/my-leagues-carousel";
import { NflDashboardSection } from "@/components/dashboard/nfl-section";
import { JoinLeagueDialog } from "@/components/leagues/join-league-dialog";
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
import { getDashboardLeagues } from "@/lib/queries/dashboard-leagues";
import { loadDashboardNfl } from "@/lib/queries/dashboard-nfl";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const [leagues, nfl] = await Promise.all([
    getDashboardLeagues(user.id),
    loadDashboardNfl(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-8 p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        Dashboard
      </h1>
      {leagues.length > 0 ? (
        <MyLeaguesCarousel leagues={leagues} />
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={LeftToRightListNumberIcon} strokeWidth={2} />
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
      <NflDashboardSection data={nfl} />
    </div>
  );
}
