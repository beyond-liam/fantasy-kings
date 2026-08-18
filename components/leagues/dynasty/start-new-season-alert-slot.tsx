import { leagueSeasons } from "@/db/schema";
import { StartNewSeasonAlert } from "@/components/leagues/dynasty/start-new-season-alert";
import { evaluateSeasonRoll } from "@/lib/leagues/season-roll/evaluate";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";

type StartNewSeasonAlertSlotProps = {
  slug: string;
  season: typeof leagueSeasons.$inferSelect;
  standingsTeams: LeagueStandingsMember[];
};

export async function StartNewSeasonAlertSlot({
  slug,
  season,
  standingsTeams,
}: StartNewSeasonAlertSlotProps) {
  const evaluation = await evaluateSeasonRoll(season, standingsTeams);
  if (!evaluation.eligible) return null;

  return (
    <StartNewSeasonAlert slug={slug} nextSeasonYear={evaluation.nextSeasonYear} />
  );
}
