import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PlayerProfileContent } from "@/components/players/player-profile-dialog";
import { getSessionUser } from "@/lib/auth/session";
import { getPlayerProfile } from "@/lib/queries/player-profile";

type PlayerProfilePageProps = {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{
    league?: string;
    season?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Player profile",
};

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

  return (
    <div className="flex flex-1 flex-col p-4 sm:p-6">
      <article className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
        <PlayerProfileContent profile={profile} headingLevel="h1" />
      </article>
    </div>
  );
}
