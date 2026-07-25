import "server-only";

import { and, asc, desc, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";

import {
  leagueMembers,
  messagePosts,
  messageThreadReads,
  messageThreads,
  profiles,
  teams,
} from "@/db/schema";
import { db } from "@/lib/db";
import type { MentionCandidate } from "@/lib/messages/mentions";

export type MessageThreadListItem = {
  id: string;
  publicId: string;
  title: string;
  replyCount: number;
  lastPostAt: Date;
  createdAt: Date;
  authorUserId: string;
  authorDisplayName: string | null;
  authorTeamId: string | null;
  authorTeamName: string | null;
  authorTeamLogoUrl: string | null;
  authorTeamPublicId: string | null;
  snippet: string | null;
  unread: boolean;
};

export type MessagePostRow = {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  authorUserId: string;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorUsername: string | null;
  authorTeamId: string | null;
  authorTeamName: string | null;
  authorTeamLogoUrl: string | null;
  authorTeamPublicId: string | null;
};

export type MessageThreadDetail = {
  id: string;
  publicId: string;
  title: string;
  replyCount: number;
  lastPostAt: Date;
  createdAt: Date;
  authorUserId: string;
  posts: MessagePostRow[];
};

function truncateSnippet(body: string, max = 120) {
  const compact = body.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}

export async function getLeagueMessageThreads(
  leagueSeasonId: string,
  userId: string,
): Promise<MessageThreadListItem[]> {
  const rows = await db
    .select({
      id: messageThreads.id,
      publicId: messageThreads.publicId,
      title: messageThreads.title,
      replyCount: messageThreads.replyCount,
      lastPostAt: messageThreads.lastPostAt,
      createdAt: messageThreads.createdAt,
      authorUserId: messageThreads.authorUserId,
      authorDisplayName: profiles.displayName,
      authorTeamId: messageThreads.authorTeamId,
      authorTeamName: teams.name,
      authorTeamLogoUrl: teams.logoUrl,
      authorTeamPublicId: teams.publicId,
      lastReadAt: messageThreadReads.lastReadAt,
      rootBody: sql<string | null>`(
        select ${messagePosts.body}
        from ${messagePosts}
        where ${messagePosts.threadId} = ${messageThreads.id}
        order by ${messagePosts.createdAt} asc
        limit 1
      )`,
    })
    .from(messageThreads)
    .leftJoin(profiles, eq(messageThreads.authorUserId, profiles.id))
    .leftJoin(teams, eq(messageThreads.authorTeamId, teams.id))
    .leftJoin(
      messageThreadReads,
      and(
        eq(messageThreadReads.threadId, messageThreads.id),
        eq(messageThreadReads.userId, userId),
      ),
    )
    .where(eq(messageThreads.leagueSeasonId, leagueSeasonId))
    .orderBy(desc(messageThreads.lastPostAt));

  return rows.map((row) => ({
    id: row.id,
    publicId: row.publicId,
    title: row.title,
    replyCount: row.replyCount,
    lastPostAt: row.lastPostAt,
    createdAt: row.createdAt,
    authorUserId: row.authorUserId,
    authorDisplayName: row.authorDisplayName,
    authorTeamId: row.authorTeamId,
    authorTeamName: row.authorTeamName,
    authorTeamLogoUrl: row.authorTeamLogoUrl,
    authorTeamPublicId: row.authorTeamPublicId,
    snippet: row.rootBody ? truncateSnippet(row.rootBody) : null,
    unread:
      row.lastReadAt == null || row.lastPostAt.getTime() > row.lastReadAt.getTime(),
  }));
}

export async function getMessageThreadByPublicId(input: {
  leagueSeasonId: string;
  publicId: string;
}): Promise<MessageThreadDetail | null> {
  const [thread] = await db
    .select({
      id: messageThreads.id,
      publicId: messageThreads.publicId,
      title: messageThreads.title,
      replyCount: messageThreads.replyCount,
      lastPostAt: messageThreads.lastPostAt,
      createdAt: messageThreads.createdAt,
      authorUserId: messageThreads.authorUserId,
    })
    .from(messageThreads)
    .where(
      and(
        eq(messageThreads.leagueSeasonId, input.leagueSeasonId),
        eq(messageThreads.publicId, input.publicId),
      ),
    )
    .limit(1);

  if (!thread) return null;

  const posts = await db
    .select({
      id: messagePosts.id,
      body: messagePosts.body,
      createdAt: messagePosts.createdAt,
      updatedAt: messagePosts.updatedAt,
      authorUserId: messagePosts.authorUserId,
      authorFirstName: profiles.firstName,
      authorLastName: profiles.lastName,
      authorUsername: profiles.username,
      authorTeamId: messagePosts.authorTeamId,
      authorTeamName: teams.name,
      authorTeamLogoUrl: teams.logoUrl,
      authorTeamPublicId: teams.publicId,
    })
    .from(messagePosts)
    .leftJoin(profiles, eq(messagePosts.authorUserId, profiles.id))
    .leftJoin(teams, eq(messagePosts.authorTeamId, teams.id))
    .where(eq(messagePosts.threadId, thread.id))
    .orderBy(asc(messagePosts.createdAt));

  return { ...thread, posts };
}

export async function getMessageNavIndicator(input: {
  leagueSeasonId: string;
  userId: string;
}): Promise<{ showDot: boolean }> {
  const [row] = await db
    .select({ id: messageThreads.id })
    .from(messageThreads)
    .leftJoin(
      messageThreadReads,
      and(
        eq(messageThreadReads.threadId, messageThreads.id),
        eq(messageThreadReads.userId, input.userId),
      ),
    )
    .where(
      and(
        eq(messageThreads.leagueSeasonId, input.leagueSeasonId),
        or(
          isNull(messageThreadReads.lastReadAt),
          gt(messageThreads.lastPostAt, messageThreadReads.lastReadAt),
        ),
      ),
    )
    .limit(1);

  return { showDot: Boolean(row) };
}

export async function markMessageThreadRead(input: {
  threadId: string;
  userId: string;
  readAt?: Date;
}) {
  const readAt = input.readAt ?? new Date();
  await db
    .insert(messageThreadReads)
    .values({
      threadId: input.threadId,
      userId: input.userId,
      lastReadAt: readAt,
    })
    .onConflictDoUpdate({
      target: [messageThreadReads.userId, messageThreadReads.threadId],
      set: { lastReadAt: readAt },
    });
}

export async function markAllMessageThreadsRead(input: {
  leagueSeasonId: string;
  userId: string;
}) {
  const threads = await db
    .select({ id: messageThreads.id, lastPostAt: messageThreads.lastPostAt })
    .from(messageThreads)
    .where(eq(messageThreads.leagueSeasonId, input.leagueSeasonId));

  if (threads.length === 0) return;

  const now = new Date();
  await db
    .insert(messageThreadReads)
    .values(
      threads.map((thread) => ({
        threadId: thread.id,
        userId: input.userId,
        lastReadAt: thread.lastPostAt > now ? thread.lastPostAt : now,
      })),
    )
    .onConflictDoUpdate({
      target: [messageThreadReads.userId, messageThreadReads.threadId],
      set: {
        lastReadAt: sql`excluded.last_read_at`,
      },
    });
}

export async function getLeagueMentionCandidates(input: {
  leagueId: string;
  leagueSeasonId: string;
}): Promise<MentionCandidate[]> {
  const rows = await db
    .select({
      userId: profiles.id,
      username: profiles.username,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      teamName: teams.name,
      teamLogoUrl: teams.logoUrl,
    })
    .from(leagueMembers)
    .innerJoin(profiles, eq(leagueMembers.userId, profiles.id))
    .leftJoin(
      teams,
      and(
        eq(teams.leagueSeasonId, input.leagueSeasonId),
        eq(teams.userId, leagueMembers.userId),
      ),
    )
    .where(
      and(
        eq(leagueMembers.leagueId, input.leagueId),
        isNotNull(profiles.username),
      ),
    )
    .orderBy(asc(profiles.username));

  return rows.flatMap((row) => {
    const username = row.username?.trim();
    if (!username) return [];
    return [
      {
        userId: row.userId,
        username,
        firstName: row.firstName,
        lastName: row.lastName,
        teamName: row.teamName,
        teamLogoUrl: row.teamLogoUrl,
      },
    ];
  });
}
