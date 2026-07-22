"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Logout01Icon,
  Settings01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { appNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { getSessionAccountSummary } from "@/lib/actions/account";
import { signOut } from "@/lib/actions/leagues";
import { teamInitials } from "@/lib/leagues/standings";

export type AppAccountSummary = {
  email: string | null;
  avatarUrl: string | null;
  username: string | null;
} | null;

function UserMenu({
  email,
  avatarUrl,
  username,
}: {
  email: string | null;
  avatarUrl: string | null;
  username: string | null;
}) {
  const initials = teamInitials(username || email || "U");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="rounded-full" />}
      >
        <Avatar size="sm">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{email ?? "Account"}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/settings" />}>
            <HugeiconsIcon icon={Settings01Icon} size={16} />
            Account Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
            <HugeiconsIcon icon={Logout01Icon} size={16} />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppTopNav({
  initialAccount,
}: {
  initialAccount: AppAccountSummary;
}) {
  const pathname = usePathname();
  const [account, setAccount] = useState(initialAccount);

  useEffect(() => {
    let cancelled = false;
    void getSessionAccountSummary().then((summary) => {
      if (cancelled) return;
      setAccount(summary);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <header className="app-chrome-nav fixed inset-x-0 top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <nav
        aria-label="Main navigation"
        className="relative flex h-14 w-full items-center px-4"
      >
        <Link
          href="/dashboard"
          className="relative z-10 shrink-0 text-sm font-semibold tracking-tight"
        >
          Fantasy Kings
        </Link>

        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <div className="pointer-events-auto flex flex-row gap-4">
            {appNavItems.map((item) => {
              const active = item.isActive(pathname);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex flex-row items-center justify-center gap-1 rounded-md px-2.5 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <HugeiconsIcon
                    icon={item.icon}
                    size={16}
                    strokeWidth={active ? 2 : 1.75}
                    className="transition-[color] duration-150 ease-out"
                  />
                  <span className="truncate">{item.shortLabel}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-0.5">
          {account ? (
            <>
              <NotificationsMenu />
              <UserMenu
                email={account.email}
                avatarUrl={account.avatarUrl}
                username={account.username}
              />
            </>
          ) : (
            <Button
              nativeButton={false}
              render={<Link href="/login" />}
              variant="outline"
              size="sm"
            >
              <HugeiconsIcon
                icon={UserIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Sign In
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
