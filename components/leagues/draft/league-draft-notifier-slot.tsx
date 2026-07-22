import { DraftPickNotifier } from "@/components/leagues/draft/draft-pick-notifier";
import { getSessionUser } from "@/lib/auth/session";
import { getDraftBySeasonId } from "@/lib/queries/draft";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
  isDraftUnderway,
} from "@/lib/queries/leagues";

/** Loads draft pick toasts without blocking the league layout shell. */
export async function LeagueDraftNotifierSlot({
  slug,
}: {
  slug: string;
}) {
  const user = await getSessionUser();
  if (!user) {
    return null;
  }

  const league = await getLeagueBySlug(slug);
  if (!league) {
    return null;
  }

  const membership = await getLeagueMembership(league.id, user.id);
  if (!membership) {
    return null;
  }

  const season = await getLeagueSeason(league.id);
  const draft = season ? await getDraftBySeasonId(season.id) : null;
  if (!draft || !isDraftUnderway(draft.status)) {
    return null;
  }

  return (
    <DraftPickNotifier
      slug={slug}
      enabled
      initialAfterOverall={draft.currentPickIndex}
    />
  );
}
