"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Cancel01Icon,
  Delete02Icon,
  FloppyDiskIcon,
  Pen01Icon,
  SendHorizontal as SendHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { MentionTextarea } from "@/components/leagues/messages/mention-textarea";
import { MessageBody } from "@/components/leagues/messages/message-body";
import {
  deleteMessagePost,
  editMessagePost,
  markThreadReadOnView,
  replyToMessageThread,
} from "@/lib/actions/messages";
import { formatPersonName } from "@/lib/account/person-name";
import { teamInitials } from "@/lib/leagues/standings";
import {
  extractMentionUsernames,
  type MentionCandidate,
} from "@/lib/messages/mentions";
import { requestNotificationsRefresh } from "@/lib/notifications/client-refresh";
import type { MessagePostRow } from "@/lib/queries/messages";

type ViewerProfile = {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
};

type ViewerTeam = {
  id: string;
  name: string;
  logoUrl: string | null;
  publicId: string | null;
};

type MessageThreadViewProps = {
  leagueSlug: string;
  threadPublicId: string;
  title: string;
  posts: MessagePostRow[];
  currentUserId: string;
  isCommissioner: boolean;
  viewerProfile: ViewerProfile;
  viewerTeam: ViewerTeam | null;
  mentionCandidates: MentionCandidate[];
};

const MotionMessageScrollerItem = motion.create(MessageScrollerItem);

function groupPostsByAuthor(posts: MessagePostRow[]) {
  const groups: MessagePostRow[][] = [];
  for (const post of posts) {
    const last = groups[groups.length - 1];
    if (last && last[0]?.authorUserId === post.authorUserId) {
      last.push(post);
    } else {
      groups.push([post]);
    }
  }
  return groups;
}

export function MessageThreadView({
  leagueSlug,
  threadPublicId,
  title,
  posts: serverPosts,
  currentUserId,
  isCommissioner,
  viewerProfile,
  viewerTeam,
  mentionCandidates,
}: MessageThreadViewProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [posts, setPosts] = useState(serverPosts);
  const [reply, setReply] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{
    postId: string;
    isRoot: boolean;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const groups = groupPostsByAuthor(posts);
  const rootPostId = posts[0]?.id;

  useEffect(() => {
    setPosts((current) => {
      const optimistic = current.filter((post) =>
        post.id.startsWith("optimistic-"),
      );
      if (optimistic.length === 0) return serverPosts;

      const remaining = optimistic.filter(
        (opt) =>
          !serverPosts.some(
            (server) =>
              server.authorUserId === opt.authorUserId &&
              server.body === opt.body &&
              server.createdAt.getTime() >= opt.createdAt.getTime() - 30_000,
          ),
      );
      return [...serverPosts, ...remaining];
    });
  }, [serverPosts]);

  useEffect(() => {
    void markThreadReadOnView(leagueSlug, threadPublicId);
  }, [leagueSlug, threadPublicId]);

  function handleReply() {
    const body = reply.trim();
    if (!body) return;

    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    const now = new Date();
    const optimisticPost: MessagePostRow = {
      id: optimisticId,
      body,
      createdAt: now,
      updatedAt: now,
      authorUserId: currentUserId,
      authorFirstName: viewerProfile.firstName,
      authorLastName: viewerProfile.lastName,
      authorUsername: viewerProfile.username,
      authorTeamId: viewerTeam?.id ?? null,
      authorTeamName: viewerTeam?.name ?? null,
      authorTeamLogoUrl: viewerTeam?.logoUrl ?? null,
      authorTeamPublicId: viewerTeam?.publicId ?? null,
    };

    setReply("");
    setPosts((current) => [...current, optimisticPost]);

    startTransition(async () => {
      const result = await replyToMessageThread(
        leagueSlug,
        threadPublicId,
        body,
      );
      if (!result.success) {
        setPosts((current) =>
          current.filter((post) => post.id !== optimisticId),
        );
        setReply(body);
        toast.error(result.error ?? "Could not post reply.");
        return;
      }
      if (extractMentionUsernames(body).length > 0) {
        requestNotificationsRefresh();
      }
      router.refresh();
    });
  }

  function handleSaveEdit(postId: string) {
    const nextBody = editBody.trim();
    if (!nextBody) return;

    const previous = posts.find((post) => post.id === postId);
    setEditingId(null);
    setEditBody("");
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, body: nextBody, updatedAt: new Date() }
          : post,
      ),
    );

    startTransition(async () => {
      const result = await editMessagePost(leagueSlug, {
        postId,
        body: nextBody,
      });
      if (!result.success) {
        if (previous) {
          setPosts((current) =>
            current.map((post) => (post.id === postId ? previous : post)),
          );
        }
        toast.error(result.error ?? "Could not edit post.");
        return;
      }
      if (extractMentionUsernames(nextBody).length > 0) {
        requestNotificationsRefresh();
      }
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!pendingDelete) return;

    const { postId, isRoot } = pendingDelete;
    setPendingDelete(null);

    const snapshot = posts;
    if (isRoot) {
      startTransition(async () => {
        const result = await deleteMessagePost(leagueSlug, postId);
        if (!result.success) {
          toast.error(result.error ?? "Could not delete post.");
          return;
        }
        router.push(`/league/${leagueSlug}/messages`);
      });
      return;
    }

    setPosts((current) => current.filter((post) => post.id !== postId));
    startTransition(async () => {
      const result = await deleteMessagePost(leagueSlug, postId);
      if (!result.success) {
        setPosts(snapshot);
        toast.error(result.error ?? "Could not delete post.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-6 pb-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {posts.length === 1 ? "1 post" : `${posts.length} posts`}
        </p>
      </div>

      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <div className="relative min-h-0 flex-1">
          <MessageScroller className="absolute inset-0">
            <MessageScrollerViewport>
              <MessageScrollerContent className="gap-6 px-6 py-2">
                {groups.map((group) => {
                  const first = group[0]!;
                  const teamLabel = first.authorTeamName ?? "Manager";

                  return group.map((post) => {
                    const canManage =
                      post.authorUserId === currentUserId || isCommissioner;
                    const isRoot = post.id === rootPostId;
                    const isEditing = editingId === post.id;
                    const edited =
                      post.updatedAt.getTime() - post.createdAt.getTime() >
                      1000;
                    const personName = formatPersonName({
                      firstName: post.authorFirstName,
                      lastName: post.authorLastName,
                      username: post.authorUsername,
                    });
                    const isNew = post.id.startsWith("optimistic-");

                    return (
                      <MotionMessageScrollerItem
                        key={post.id}
                        messageId={post.id}
                        initial={
                          isNew && !reduceMotion
                            ? { opacity: 0, x: -24 }
                            : false
                        }
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.28,
                          ease: [0.23, 1, 0.32, 1],
                        }}
                      >
                        <MessageGroup>
                          <Message align="start">
                            <MessageAvatar>
                              <Avatar size="sm">
                                {post.authorTeamLogoUrl ? (
                                  <AvatarImage
                                    src={post.authorTeamLogoUrl}
                                    alt=""
                                  />
                                ) : null}
                                <AvatarFallback>
                                  {teamInitials(teamLabel)}
                                </AvatarFallback>
                              </Avatar>
                            </MessageAvatar>
                            <MessageContent>
                              {isEditing ? (
                                <Bubble
                                  variant="outline"
                                  align="start"
                                  className="w-full max-w-full"
                                >
                                  <BubbleContent className="w-full max-w-full space-y-2 p-2">
                                    <p className="text-[9px] font-medium">
                                      {personName}
                                    </p>
                                    <MentionTextarea
                                      value={editBody}
                                      disabled={isPending}
                                      className="min-h-24"
                                      candidates={mentionCandidates}
                                      onValueChange={setEditBody}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        disabled={
                                          isPending || !editBody.trim()
                                        }
                                        onClick={() =>
                                          handleSaveEdit(post.id)
                                        }
                                      >
                                        <HugeiconsIcon
                                          icon={FloppyDiskIcon}
                                          strokeWidth={2}
                                          data-icon="inline-start"
                                        />
                                        Save
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={isPending}
                                        onClick={() => {
                                          setEditingId(null);
                                          setEditBody("");
                                        }}
                                      >
                                        <HugeiconsIcon
                                          icon={Cancel01Icon}
                                          strokeWidth={2}
                                          data-icon="inline-start"
                                        />
                                        Cancel
                                      </Button>
                                    </div>
                                  </BubbleContent>
                                </Bubble>
                              ) : (
                                <Bubble variant="muted" align="start">
                                  <BubbleContent className="flex flex-col gap-1">
                                    <p className="text-[9px] font-medium">
                                      {personName}
                                    </p>
                                    <MessageBody body={post.body} />
                                  </BubbleContent>
                                </Bubble>
                              )}
                              <MessageFooter className="gap-2">
                                <span>
                                  {format(
                                    post.createdAt,
                                    "d MMM yyyy · HH:mm",
                                  )}
                                  {edited ? " · edited" : null}
                                </span>
                                {canManage && !isEditing ? (
                                  <span className="flex items-center gap-0.5">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="xs"
                                      onClick={() => {
                                        setEditingId(post.id);
                                        setEditBody(post.body);
                                      }}
                                    >
                                      <HugeiconsIcon
                                        icon={Pen01Icon}
                                        strokeWidth={2}
                                        data-icon="inline-start"
                                      />
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="xs"
                                      onClick={() =>
                                        setPendingDelete({
                                          postId: post.id,
                                          isRoot,
                                        })
                                      }
                                    >
                                      <HugeiconsIcon
                                        icon={Delete02Icon}
                                        strokeWidth={2}
                                        data-icon="inline-start"
                                      />
                                      Delete
                                    </Button>
                                  </span>
                                ) : null}
                              </MessageFooter>
                            </MessageContent>
                          </Message>
                        </MessageGroup>
                      </MotionMessageScrollerItem>
                    );
                  });
                })}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </div>
      </MessageScrollerProvider>

      <div className="shrink-0 bg-transparent px-6 py-3">
        <div className="rounded-2xl bg-muted">
          <label htmlFor="thread-reply" className="sr-only">
            Reply
          </label>
          <MentionTextarea
            id="thread-reply"
            value={reply}
            placeholder="Write a reply… Use @ to mention someone"
            className="h-24 resize-none border border-input-border !bg-slate-950 shadow-none appearance-none focus-visible:border-input-border focus-visible:ring-0 focus-visible:shadow-none p-4 rounded-2xl"
            candidates={mentionCandidates}
            onValueChange={setReply}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                handleReply();
              }
            }}
          />
          <div className="flex justify-end p-3">
            <Button
              type="button"
              disabled={!reply.trim()}
              onClick={handleReply}
              size="sm"
            >
              <HugeiconsIcon
                icon={SendHorizontalIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Send
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.isRoot ? "Delete thread?" : "Delete reply?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.isRoot
                ? "This will delete the thread and all replies. This cannot be undone."
                : "This reply will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="ghost" disabled={isPending}>
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={confirmDelete}
            >
              <HugeiconsIcon
                icon={Delete02Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
