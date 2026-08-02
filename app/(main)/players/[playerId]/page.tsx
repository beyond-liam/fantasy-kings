import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PlayerPageTemplate } from "@/components/players/player-page-template";
import { getSessionUser } from "@/lib/auth/session";
import { getPlayerProfile } from "@/lib/queries/player-profile";

type PlayerProfilePageProps = {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{
    league?: string;
    season?: string;
  }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ playerId: string }>;
}): Promise<Metadata> {
  const { playerId } = await params;
  const profile = await getPlayerProfile({ playerId });
  return {
    title: profile?.fullName ?? "Player profile",
  };
}

export default async function PlayerProfilePage({
  params,
  searchParams,
}: PlayerProfilePageProps) {
  const [{ playerId }, query, user] = await Promise.all([
    params,
    searchParams,
    getSessionUser(),
  ]);

  if (!user) {
    const leagueQuery = query.league
      ? `?league=${encodeURIComponent(query.league)}`
      : "";
    redirect(
      `/login?next=${encodeURIComponent(`/players/${playerId}${leagueQuery}`)}`,
    );
  }

  const profile = await getPlayerProfile({
    playerId,
    leagueSlug: query.league,
    season: query.season,
  });

  if (!profile) {
    notFound();
  }

  return <PlayerPageTemplate profile={profile} />;
}
