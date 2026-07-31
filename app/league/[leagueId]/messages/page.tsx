import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MarkAllMessagesReadButton } from "@/components/leagues/messages/mark-all-read-button";
import { MessageThreadList } from "@/components/leagues/messages/message-thread-list";
import { NewMessageDialog } from "@/components/leagues/messages/new-message-dialog";
import { getSessionUser } from "@/lib/auth/session";
import { getLeagueHomeData } from "@/lib/queries/leagues";
import {
  getLeagueMentionCandidates,
  getLeagueMessageThreads,
} from "@/lib/queries/messages";

type MessagesPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Messages",
};

export default async function MessagesPage({ params }: MessagesPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/messages`);
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data || !data.isMember || !data.season) {
    redirect("/leagues");
  }

  const [threads, mentionCandidates] = await Promise.all([
    getLeagueMessageThreads(data.season.id, user.id),
    getLeagueMentionCandidates({
      leagueId: data.league.id,
      leagueSeasonId: data.season.id,
    }),
  ]);
  const hasUnread = threads.some((thread) => thread.unread);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-balance">
          Messages
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <MarkAllMessagesReadButton
            leagueSlug={slug}
            disabled={!hasUnread}
          />
          <NewMessageDialog
            leagueSlug={slug}
            mentionCandidates={mentionCandidates}
          />
        </div>
      </div>

      <MessageThreadList leagueSlug={slug} threads={threads} />
    </div>
  );
}
