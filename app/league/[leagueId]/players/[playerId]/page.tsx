import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PlayerPageTemplate } from "@/components/players/player-page-template";
import { getSessionUser } from "@/lib/auth/session";
import {
  getLeagueBySlug,
  getLeagueMembership,
} from "@/lib/queries/leagues";
import { playerProfileHref } from "@/lib/players/profile-path";
import { getPlayerProfile } from "@/lib/queries/player-profile";

type LeaguePlayerProfilePageProps = {
  params: Promise<{ leagueId: string; playerId: string }>;
  searchParams: Promise<{ season?: string }>;
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

export default async function LeaguePlayerProfilePage({
  params,
  searchParams,
}: LeaguePlayerProfilePageProps) {
  const [{ leagueId: slug, playerId }, query, user] = await Promise.all([
    params,
    searchParams,
    getSessionUser(),
  ]);

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/league/${slug}/players/${playerId}`)}`,
    );
  }

  const league = await getLeagueBySlug(slug);
  if (!league) {
    redirect("/leagues");
  }

  const membership = await getLeagueMembership(league.id, user.id);
  if (!membership) {
    redirect("/leagues");
  }

  const profile = await getPlayerProfile({
    playerId,
    leagueSlug: slug,
    season: query.season,
  });

  if (!profile) {
    notFound();
  }

  // UUID (or stale) bookmarks → canonical short public id
  if (playerId !== profile.publicId) {
    redirect(
      playerProfileHref({
        playerId: profile.publicId,
        leagueSlug: league.publicId,
        season: query.season ?? profile.season,
      }),
    );
  }

  return <PlayerPageTemplate profile={profile} />;
}
