import { LeagueSideNav } from "@/components/layout/league-side-nav";
import { getSessionUser } from "@/lib/auth/session";
import { hasCommissionerPowers } from "@/lib/leagues/membership";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
} from "@/lib/queries/leagues";
import { getTradeNavIndicator } from "@/lib/queries/trades";
import { getUserTeamForSeason } from "@/lib/queries/watchlist";

/** Resolves commissioner role without blocking league page children. */
export async function LeagueSideNavSlot({ slug }: { slug: string }) {
  const user = await getSessionUser();
  const league = user ? await getLeagueBySlug(slug) : null;
  const membership =
    user && league ? await getLeagueMembership(league.id, user.id) : null;
  const season = league ? await getLeagueSeason(league.id) : null;
  const team =
    user && season ? await getUserTeamForSeason(season.id, user.id) : null;
  const isCommissioner = hasCommissionerPowers(membership?.role);

  const indicator =
    season && team
      ? await getTradeNavIndicator({
          leagueSeasonId: season.id,
          teamId: team.id,
          isCommissioner,
          tradeProcessing: season.tradeProcessing,
        })
      : { showDot: false };

  return (
    <LeagueSideNav
      slug={slug}
      isCommissioner={isCommissioner}
      tradesAttention={indicator.showDot}
    />
  );
}
