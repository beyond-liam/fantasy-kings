import { Suspense } from "react";

import { ContentContainer } from "@/components/layout/content-container";
import { LeagueSideNav } from "@/components/layout/league-side-nav";
import { LeagueSideNavSlot } from "@/components/layout/league-side-nav-slot";
import { LeagueDraftNotifierSlot } from "@/components/leagues/draft/league-draft-notifier-slot";
import { LeagueLayoutGuard } from "@/components/leagues/league-layout-guard";

export default async function LeagueLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}>) {
  const { leagueId: slug } = await params;

  return (
    <LeagueLayoutGuard params={params}>
      <div className="relative flex min-h-0 flex-1">
        <Suspense fallback={<LeagueSideNav slug={slug} isCommissioner={false} />}>
          <LeagueSideNavSlot slug={slug} />
        </Suspense>
        <div className="ml-[4.5rem] flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-none">
          <ContentContainer className="flex flex-col">
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
