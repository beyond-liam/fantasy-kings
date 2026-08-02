import Link from "next/link";
import { format } from "date-fns";
import { Comment01Icon, MessageBlockedIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { ManagerPresenceBadge } from "@/components/leagues/presence/manager-presence-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { teamInitials } from "@/lib/leagues/standings";
import type { MessageThreadListItem } from "@/lib/queries/messages";
import { cn } from "@/lib/utils";

type MessageThreadListProps = {
  leagueSlug: string;
  threads: MessageThreadListItem[];
};

export function MessageThreadList({
  leagueSlug,
  threads,
}: MessageThreadListProps) {
  if (threads.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={MessageBlockedIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>No messages yet</EmptyTitle>
          <EmptyDescription>
            Start a thread to share news, rules, or banter with the league.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="divide-y border-y md:rounded-xl md:border">
      {threads.map((thread) => {
        const authorLabel =
          thread.authorTeamName ??
          thread.authorDisplayName ??
          "Manager";
        const href = `/league/${leagueSlug}/messages/${thread.publicId}`;

        return (
          <li key={thread.id}>
            <Link
              href={href}
              className={cn(
                "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                thread.unread && "bg-muted/30",
              )}
            >
              <Avatar size="sm" className="mt-0.5">
                {thread.authorTeamLogoUrl ? (
                  <AvatarImage src={thread.authorTeamLogoUrl} alt="" />
                ) : null}
                <AvatarFallback>
                  {teamInitials(authorLabel)}
                </AvatarFallback>
                <ManagerPresenceBadge userId={thread.authorUserId} />
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={cn(
                      "truncate text-base text-balance md:text-sm",
                      thread.unread ? "font-semibold" : "font-medium",
                    )}
                  >
                    {thread.title}
                  </p>
                  {thread.replyCount > 0 ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                      <HugeiconsIcon
                        icon={Comment01Icon}
                        size={14}
                        strokeWidth={2}
                      />
                      {thread.replyCount}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  <span className={thread.unread ? "text-foreground" : undefined}>
                    {authorLabel}
                  </span>
                  {" posted on "}
                  {format(thread.createdAt, "d MMM yyyy")}
                </p>
              </div>
              {thread.unread ? (
                <span
                  className="mt-2 size-2 shrink-0 rounded-full bg-destructive"
                  aria-label="Unread"
                />
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
