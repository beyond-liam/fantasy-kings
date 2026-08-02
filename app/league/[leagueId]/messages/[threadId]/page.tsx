import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MessageThreadView } from "@/components/leagues/messages/message-thread-view";
import { getSessionUser } from "@/lib/auth/session";
import { hasCommissionerPowers } from "@/lib/leagues/membership";
import { getLeagueHomeData, getLeagueMembership } from "@/lib/queries/leagues";
import {
  getLeagueMentionCandidates,
  getMessageThreadByPublicId,
} from "@/lib/queries/messages";
import { getUserTeamForSeason } from "@/lib/queries/watchlist";
import { db } from "@/lib/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

type MessageThreadPageProps = {
  params: Promise<{ leagueId: string; threadId: string }>;
};

export const metadata: Metadata = {
  title: "Message",
};

export default async function MessageThreadPage({
  params,
}: MessageThreadPageProps) {
  const { leagueId: slug, threadId } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/messages/${threadId}`);
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data || !data.isMember || !data.season) {
    redirect("/leagues");
  }

  const thread = await getMessageThreadByPublicId({
    leagueSeasonId: data.season.id,
    publicId: threadId,
  });
  if (!thread) {
    redirect(`/league/${slug}/messages`);
  }

  const [membership, team, profile, mentionCandidates] = await Promise.all([
    getLeagueMembership(data.league.id, user.id),
    getUserTeamForSeason(data.season.id, user.id),
    db
      .select({
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        username: profiles.username,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getLeagueMentionCandidates({
      leagueId: data.league.id,
      leagueSeasonId: data.season.id,
    }),
  ]);
  const isCommissioner = hasCommissionerPowers(membership?.role);

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col overflow-hidden md:h-[calc(100dvh-3.5rem)]">
      <MessageThreadView
        leagueSlug={slug}
        threadPublicId={thread.publicId}
        title={thread.title}
        posts={thread.posts}
        currentUserId={user.id}
        isCommissioner={isCommissioner}
        backHref={`/league/${slug}/messages`}
        viewerProfile={{
          firstName: profile?.firstName ?? null,
          lastName: profile?.lastName ?? null,
          username: profile?.username ?? null,
        }}
        viewerTeam={
          team
            ? {
                id: team.id,
                name: team.name,
                logoUrl: team.logoUrl,
                publicId: team.publicId,
              }
            : null
        }
        mentionCandidates={mentionCandidates}
      />
    </div>
  );
}
