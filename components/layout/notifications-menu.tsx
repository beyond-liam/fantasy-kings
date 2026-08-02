"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BellIcon,
  BellOffIcon,
  Eraser01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyDescription,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  clearAllNotifications,
  getSessionNotifications,
  markNotificationRead,
  type NotificationsPayload,
} from "@/lib/actions/notifications";
import {
  NOTIFICATIONS_REFRESH_EVENT,
} from "@/lib/notifications/client-refresh";
import { cn } from "@/lib/utils";

function formatNotificationTime(date: Date) {
  const created = date instanceof Date ? date : new Date(date);
  const diffMs = Math.max(0, Date.now() - created.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(days / 365);
  return `${Math.max(1, years)}y`;
}

export function NotificationsMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<NotificationsPayload | null>(null);
  const [pending, startTransition] = useTransition();

  function loadNotifications() {
    return getSessionNotifications().then(setPayload);
  }

  useEffect(() => {
    let cancelled = false;
    void getSessionNotifications().then((next) => {
      if (!cancelled) setPayload(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onRefresh() {
      void loadNotifications();
    }
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getSessionNotifications().then((next) => {
      if (!cancelled) setPayload(next);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const items = payload?.items ?? [];
  const unreadCount = payload?.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;

  function refresh() {
    startTransition(() => {
      void loadNotifications();
    });
  }

  function onClear() {
    startTransition(async () => {
      const result = await clearAllNotifications();
      if (result.success) {
        setPayload({ items: [], unreadCount: 0 });
      }
    });
  }

  function onItemClick(item: NotificationsPayload["items"][number]) {
    if (!item.readAt) {
      setPayload((prev) => {
        if (!prev) return prev;
        return {
          unreadCount: Math.max(0, prev.unreadCount - 1),
          items: prev.items.map((row) =>
            row.id === item.id ? { ...row, readAt: new Date() } : row,
          ),
        };
      });
      void markNotificationRead(item.id).then(() => refresh());
    }
    setOpen(false);
    router.push(item.href);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-10 md:size-9 [&_svg]:size-6 md:[&_svg]:size-5"
            aria-label="Notifications"
          />
        }
      >
        <span className="relative inline-flex">
          <HugeiconsIcon icon={BellIcon} strokeWidth={2} />
          {hasUnread ? (
            <span
              aria-hidden
              className="absolute top-0.5 right-0.5 size-2 rounded-full bg-destructive"
            />
          ) : null}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between gap-2 py-1.5">
            <span>Notifications</span>
            {items.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={pending}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onClear();
                }}
              >
                <HugeiconsIcon
                  icon={Eraser01Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Clear
              </Button>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <DropdownMenuGroup>
        <Empty className="border-none" size="sm">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-background">
              <HugeiconsIcon icon={BellOffIcon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No notifications yet</EmptyTitle>
            <EmptyDescription>
              Trade updates, claims, and league news will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
          </DropdownMenuGroup>
        ) : (
          <DropdownMenuGroup className="max-h-80 overflow-y-auto">
            {items.map((item) => {
              const unread = !item.readAt;
              return (
                <DropdownMenuItem
                  key={item.id}
                  className="cursor-pointer items-start gap-2 py-2.5 whitespace-normal"
                  onClick={() => onItemClick(item)}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      unread ? "bg-destructive" : "bg-transparent",
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {item.leagueName ? (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {item.leagueName}
                      </span>
                    ) : null}
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-sm font-medium text-foreground">
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {formatNotificationTime(item.createdAt)}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {item.body}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
