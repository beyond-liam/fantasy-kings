import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/layout/content-container";
import { LeagueSideNav } from "@/components/layout/league-side-nav";
import { LeagueSideNavSlot } from "@/components/layout/league-side-nav-slot";
import { LeagueDraftNotifierSlot } from "@/components/leagues/draft/league-draft-notifier-slot";
import { LeagueLayoutGuard } from "@/components/leagues/league-layout-guard";
import { getLeagueBySlug } from "@/lib/queries/leagues";

type LeagueLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}>;

export async function generateMetadata({
  params,
}: LeagueLayoutProps): Promise<Metadata> {
  const { leagueId: slug } = await params;
  const league = await getLeagueBySlug(slug);
  const leagueName = league?.name ?? "League";
  return {
    title: {
      // League home uses default (no page title). Child routes become
      // `Messages | {leagueName}`, `Matchups | {leagueName}`, etc.
      default: leagueName,
      template: `%s | ${leagueName}`,
    },
  };
}

export default async function LeagueLayout({
  children,
  params,
}: LeagueLayoutProps) {
  const { leagueId: slug } = await params;

  return (
    <LeagueLayoutGuard params={params}>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<LeagueSideNav slug={slug} isCommissioner={false} />}>
          <LeagueSideNavSlot slug={slug} />
        </Suspense>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:ml-18">
          <ContentContainer className="flex min-h-0 flex-1 flex-col">
            {children}
          </ContentContainer>
        </div>
        <Suspense fallback={null}>
          <LeagueDraftNotifierSlot slug={slug} />
        </Suspense>
      </div>
    </LeagueLayoutGuard>
  );
}
