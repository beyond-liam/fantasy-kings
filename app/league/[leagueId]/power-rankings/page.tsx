import { redirect } from "next/navigation";

type PowerRankingsRedirectProps = {
  params: Promise<{ leagueId: string }>;
};

/** Old side-nav route → league home Power Rankings tab. */
export default async function PowerRankingsRedirectPage({
  params,
}: PowerRankingsRedirectProps) {
  const { leagueId: slug } = await params;
  redirect(`/league/${slug}?tab=power-rankings`);
}
