import { LeagueSideNav } from "@/components/layout/league-side-nav";
import { getSessionUser } from "@/lib/auth/session";
import { hasCommissionerPowers } from "@/lib/leagues/membership";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
} from "@/lib/queries/leagues";
import { getMessageNavIndicator } from "@/lib/queries/messages";
import { getTradeNavIndicator } from "@/lib/queries/trades";
import { getUserTeamForSeason } from "@/lib/queries/watchlist";

/** Resolves commissioner role without blocking league page children. */
export async function LeagueSideNavSlot({ slug }: { slug: string }) {
  const user = await getSessionUser();
  if (!user) {
    return (
      <LeagueSideNav
        slug={slug}
        isCommissioner={false}
        tradesAttention={false}
        messagesAttention={false}
      />
    );
  }

  const league = await getLeagueBySlug(slug);
  if (!league) {
    return (
      <LeagueSideNav
        slug={slug}
        isCommissioner={false}
        tradesAttention={false}
        messagesAttention={false}
      />
    );
  }

  const [membership, season] = await Promise.all([
    getLeagueMembership(league.id, user.id),
    getLeagueSeason(league.id),
  ]);
  const isCommissioner = hasCommissionerPowers(membership?.role);

  const team =
    season != null
      ? await getUserTeamForSeason(season.id, user.id)
      : null;

  const [tradeIndicator, messageIndicator] = await Promise.all([
    season && team
      ? getTradeNavIndicator({
          leagueSeasonId: season.id,
          teamId: team.id,
          isCommissioner,
          tradeProcessing: season.tradeProcessing,
        })
      : Promise.resolve({ showDot: false }),
    season
      ? getMessageNavIndicator({
          leagueSeasonId: season.id,
          userId: user.id,
        })
      : Promise.resolve({ showDot: false }),
  ]);

  return (
    <LeagueSideNav
      slug={slug}
      isCommissioner={isCommissioner}
      tradesAttention={tradeIndicator.showDot}
      messagesAttention={messageIndicator.showDot}
    />
  );
}
