"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BellIcon,
  Eraser01Icon,
  NotificationOff01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  clearAllNotifications,
  getSessionNotifications,
  markNotificationRead,
  type NotificationsPayload,
} from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";

function formatNotificationTime(date: Date) {
  const created = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - created.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return created.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function NotificationsMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<NotificationsPayload | null>(null);
  const [pending, startTransition] = useTransition();

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
      void getSessionNotifications().then(setPayload);
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
          <Button variant="ghost" size="icon" aria-label="Notifications" />
        }
      >
        <span className="relative inline-flex">
          <HugeiconsIcon icon={BellIcon} size={20} />
          {hasUnread ? (
            <span
              aria-hidden
              className="absolute top-0 right-0 size-2 rounded-full bg-destructive"
            />
          ) : null}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            Notifications
          </p>
          {items.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={pending}
              onClick={onClear}
            >
              <HugeiconsIcon
                icon={Eraser01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Clear
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="my-0" />
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <HugeiconsIcon
              icon={NotificationOff01Icon}
              size={20}
              className="text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <DropdownMenuGroup className="max-h-80 overflow-y-auto py-1">
            {items.map((item) => {
              const unread = !item.readAt;
              return (
                <DropdownMenuItem
                  key={item.id}
                  className="cursor-pointer items-start gap-2 rounded-none px-3 py-2.5"
                  onClick={() => onItemClick(item)}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      unread ? "bg-destructive" : "bg-transparent",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                      {item.body}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground tabular-nums">
                      {formatNotificationTime(item.createdAt)}
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
