"use server";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { messagePosts, messageThreads, profiles } from "@/db/schema";
import { db } from "@/lib/db";
import { loadLeagueActionContext } from "@/lib/leagues/action-context";
import { generatePublicId } from "@/lib/leagues/public-id";
import {
  authorLabelFromProfile,
  notifyMessageMentions,
} from "@/lib/messages/notify-mentions";
import {
  markAllMessageThreadsRead,
  markMessageThreadRead,
} from "@/lib/queries/messages";

type ActionResult = {
  success: boolean;
  error?: string;
  threadPublicId?: string;
};

const TITLE_MAX = 120;
const BODY_MAX = 10_000;

function revalidateMessagePaths(slug: string, threadPublicId?: string) {
  revalidatePath(`/league/${slug}/messages`);
  if (threadPublicId) {
    revalidatePath(`/league/${slug}/messages/${threadPublicId}`);
  }
}

function parseTitle(raw: string) {
  const title = raw.replace(/\s+/g, " ").trim();
  if (!title) return { error: "Title is required." as const };
  if (title.length > TITLE_MAX) {
    return { error: `Title must be ${TITLE_MAX} characters or fewer.` as const };
  }
  return { title };
}

function parseBody(raw: string) {
  const body = raw.trim();
  if (!body) return { error: "Message is required." as const };
  if (body.length > BODY_MAX) {
    return { error: `Message must be ${BODY_MAX} characters or fewer.` as const };
  }
  return { body };
}

async function getAuthorLabel(userId: string) {
  const [profile] = await db
    .select({
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      username: profiles.username,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return authorLabelFromProfile(profile ?? {});
}

async function allocateThreadPublicId(leagueSeasonId: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const publicId = generatePublicId();
    const [hit] = await db
      .select({ id: messageThreads.id })
      .from(messageThreads)
      .where(
        and(
          eq(messageThreads.leagueSeasonId, leagueSeasonId),
          eq(messageThreads.publicId, publicId),
        ),
      )
      .limit(1);
    if (!hit) return publicId;
  }
  throw new Error("Could not allocate message thread public id");
}

export async function createMessageThread(
  slug: string,
  input: { title: string; body: string },
): Promise<ActionResult> {
  try {
    const ctx = await loadLeagueActionContext(slug, {
      requireTeam: true,
      includeCommissioner: true,
    });
    if ("error" in ctx) {
      return { success: false, error: ctx.error };
    }

    const titleParsed = parseTitle(input.title);
    if ("error" in titleParsed) {
      return { success: false, error: titleParsed.error };
    }
    const bodyParsed = parseBody(input.body);
    if ("error" in bodyParsed) {
      return { success: false, error: bodyParsed.error };
    }

    const publicId = await allocateThreadPublicId(ctx.season.id);
    const now = new Date();
    const body = bodyParsed.body!;
    const title = titleParsed.title!;

    const threadId = await db.transaction(async (tx) => {
      const [thread] = await tx
        .insert(messageThreads)
        .values({
          leagueSeasonId: ctx.season.id,
          publicId,
          title,
          authorUserId: ctx.user.id,
          authorTeamId: ctx.team!.id,
          replyCount: 0,
          lastPostAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: messageThreads.id });

      await tx.insert(messagePosts).values({
        threadId: thread!.id,
        authorUserId: ctx.user.id,
        authorTeamId: ctx.team!.id,
        body,
        createdAt: now,
        updatedAt: now,
      });

      return thread!.id;
    });

    await markMessageThreadRead({
      threadId,
      userId: ctx.user.id,
      readAt: now,
    });

    await notifyMessageMentions({
      body,
      authorUserId: ctx.user.id,
      authorLabel: await getAuthorLabel(ctx.user.id),
      leagueId: ctx.league.id,
      leagueSeasonId: ctx.season.id,
      leagueSlug: slug,
      threadPublicId: publicId,
      threadTitle: title,
    });

    revalidateMessagePaths(slug, publicId);
    return { success: true, threadPublicId: publicId };
  } catch (error) {
    console.error("createMessageThread failed", error);
    return { success: false, error: "Could not post message. Try again." };
  }
}

export async function replyToMessageThread(
  slug: string,
  threadPublicId: string,
  bodyRaw: string,
): Promise<ActionResult> {
  try {
    const ctx = await loadLeagueActionContext(slug, {
      requireTeam: true,
      includeCommissioner: true,
    });
    if ("error" in ctx) {
      return { success: false, error: ctx.error };
    }

    const bodyParsed = parseBody(bodyRaw);
    if ("error" in bodyParsed) {
      return { success: false, error: bodyParsed.error };
    }

    const [thread] = await db
      .select({
        id: messageThreads.id,
        publicId: messageThreads.publicId,
        title: messageThreads.title,
      })
      .from(messageThreads)
      .where(
        and(
          eq(messageThreads.leagueSeasonId, ctx.season.id),
          eq(messageThreads.publicId, threadPublicId),
        ),
      )
      .limit(1);

    if (!thread) {
      return { success: false, error: "Thread not found." };
    }

    const now = new Date();
    const body = bodyParsed.body!;
    await db.transaction(async (tx) => {
      await tx.insert(messagePosts).values({
        threadId: thread.id,
        authorUserId: ctx.user.id,
        authorTeamId: ctx.team!.id,
        body,
        createdAt: now,
        updatedAt: now,
      });
      await tx
        .update(messageThreads)
        .set({
          replyCount: sql`${messageThreads.replyCount} + 1`,
          lastPostAt: now,
          updatedAt: now,
        })
        .where(eq(messageThreads.id, thread.id));
    });

    await markMessageThreadRead({
      threadId: thread.id,
      userId: ctx.user.id,
      readAt: now,
    });

    await notifyMessageMentions({
      body,
      authorUserId: ctx.user.id,
      authorLabel: await getAuthorLabel(ctx.user.id),
      leagueId: ctx.league.id,
      leagueSeasonId: ctx.season.id,
      leagueSlug: slug,
      threadPublicId: thread.publicId,
      threadTitle: thread.title,
    });

    revalidateMessagePaths(slug, thread.publicId);
    return { success: true, threadPublicId: thread.publicId };
  } catch (error) {
    console.error("replyToMessageThread failed", error);
    return { success: false, error: "Could not post reply. Try again." };
  }
}

export async function editMessagePost(
  slug: string,
  input: { postId: string; body: string },
): Promise<ActionResult> {
  try {
    const ctx = await loadLeagueActionContext(slug, {
      requireMembership: true,
      includeCommissioner: true,
    });
    if ("error" in ctx) {
      return { success: false, error: ctx.error };
    }

    const bodyParsed = parseBody(input.body);
    if ("error" in bodyParsed) {
      return { success: false, error: bodyParsed.error };
    }

    const [post] = await db
      .select({
        id: messagePosts.id,
        body: messagePosts.body,
        authorUserId: messagePosts.authorUserId,
        threadId: messagePosts.threadId,
        threadPublicId: messageThreads.publicId,
        threadTitle: messageThreads.title,
        leagueSeasonId: messageThreads.leagueSeasonId,
      })
      .from(messagePosts)
      .innerJoin(messageThreads, eq(messagePosts.threadId, messageThreads.id))
      .where(eq(messagePosts.id, input.postId))
      .limit(1);

    if (!post || post.leagueSeasonId !== ctx.season.id) {
      return { success: false, error: "Post not found." };
    }

    const canEdit =
      post.authorUserId === ctx.user.id || ctx.isCommissioner;
    if (!canEdit) {
      return { success: false, error: "You cannot edit this post." };
    }

    const body = bodyParsed.body!;
    await db
      .update(messagePosts)
      .set({ body, updatedAt: new Date() })
      .where(eq(messagePosts.id, post.id));

    await notifyMessageMentions({
      body,
      previousBody: post.body,
      authorUserId: post.authorUserId,
      authorLabel: await getAuthorLabel(post.authorUserId),
      leagueId: ctx.league.id,
      leagueSeasonId: ctx.season.id,
      leagueSlug: slug,
      threadPublicId: post.threadPublicId,
      threadTitle: post.threadTitle,
    });

    revalidateMessagePaths(slug, post.threadPublicId);
    return { success: true, threadPublicId: post.threadPublicId };
  } catch (error) {
    console.error("editMessagePost failed", error);
    return { success: false, error: "Could not edit post. Try again." };
  }
}

export async function deleteMessagePost(
  slug: string,
  postId: string,
): Promise<ActionResult> {
  try {
    const ctx = await loadLeagueActionContext(slug, {
      requireMembership: true,
      includeCommissioner: true,
    });
    if ("error" in ctx) {
      return { success: false, error: ctx.error };
    }

    const [post] = await db
      .select({
        id: messagePosts.id,
        authorUserId: messagePosts.authorUserId,
        createdAt: messagePosts.createdAt,
        threadId: messagePosts.threadId,
        threadPublicId: messageThreads.publicId,
        leagueSeasonId: messageThreads.leagueSeasonId,
      })
      .from(messagePosts)
      .innerJoin(messageThreads, eq(messagePosts.threadId, messageThreads.id))
      .where(eq(messagePosts.id, postId))
      .limit(1);

    if (!post || post.leagueSeasonId !== ctx.season.id) {
      return { success: false, error: "Post not found." };
    }

    const canDelete =
      post.authorUserId === ctx.user.id || ctx.isCommissioner;
    if (!canDelete) {
      return { success: false, error: "You cannot delete this post." };
    }

    const [root] = await db
      .select({ id: messagePosts.id })
      .from(messagePosts)
      .where(eq(messagePosts.threadId, post.threadId))
      .orderBy(asc(messagePosts.createdAt))
      .limit(1);

    const isRoot = root?.id === post.id;

    if (isRoot) {
      await db
        .delete(messageThreads)
        .where(eq(messageThreads.id, post.threadId));
      revalidateMessagePaths(slug);
      return { success: true };
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.delete(messagePosts).where(eq(messagePosts.id, post.id));
      const [latest] = await tx
        .select({ createdAt: messagePosts.createdAt })
        .from(messagePosts)
        .where(eq(messagePosts.threadId, post.threadId))
        .orderBy(desc(messagePosts.createdAt))
        .limit(1);
      await tx
        .update(messageThreads)
        .set({
          replyCount: sql`greatest(${messageThreads.replyCount} - 1, 0)`,
          lastPostAt: latest?.createdAt ?? now,
          updatedAt: now,
        })
        .where(eq(messageThreads.id, post.threadId));
    });

    revalidateMessagePaths(slug, post.threadPublicId);
    return { success: true, threadPublicId: post.threadPublicId };
  } catch (error) {
    console.error("deleteMessagePost failed", error);
    return { success: false, error: "Could not delete post. Try again." };
  }
}

export async function markLeagueMessagesRead(
  slug: string,
): Promise<ActionResult> {
  try {
    const ctx = await loadLeagueActionContext(slug, {
      requireMembership: true,
    });
    if ("error" in ctx) {
      return { success: false, error: ctx.error };
    }

    await markAllMessageThreadsRead({
      leagueSeasonId: ctx.season.id,
      userId: ctx.user.id,
    });

    revalidateMessagePaths(slug);
    return { success: true };
  } catch (error) {
    console.error("markLeagueMessagesRead failed", error);
    return { success: false, error: "Could not mark messages as read." };
  }
}

export async function markThreadReadOnView(
  slug: string,
  threadPublicId: string,
): Promise<ActionResult> {
  try {
    const ctx = await loadLeagueActionContext(slug, {
      requireMembership: true,
    });
    if ("error" in ctx) {
      return { success: false, error: ctx.error };
    }

    const [thread] = await db
      .select({
        id: messageThreads.id,
        lastPostAt: messageThreads.lastPostAt,
      })
      .from(messageThreads)
      .where(
        and(
          eq(messageThreads.leagueSeasonId, ctx.season.id),
          eq(messageThreads.publicId, threadPublicId),
        ),
      )
      .limit(1);

    if (!thread) {
      return { success: false, error: "Thread not found." };
    }

    await markMessageThreadRead({
      threadId: thread.id,
      userId: ctx.user.id,
      readAt: thread.lastPostAt,
    });

    revalidateMessagePaths(slug, threadPublicId);
    return { success: true, threadPublicId };
  } catch (error) {
    console.error("markThreadReadOnView failed", error);
    return { success: false, error: "Could not update read state." };
  }
}
