"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Link01Icon,
  Logout01Icon,
  Menu01Icon,
  Settings01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { appNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { JoinLeagueDialog } from "@/components/leagues/join-league-dialog";
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
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { signOut } from "@/lib/actions/leagues";
import { formatRecord, teamInitials } from "@/lib/leagues/standings";
import type { UserLeagueNavItem } from "@/lib/queries/leagues";

export type AppAccountSummary = {
  email: string | null;
  avatarUrl: string | null;
  username: string | null;
} | null;

/** Full navigation so the server re-renders chrome without the session. */
async function handleSignOut() {
  await signOut();
  window.location.assign("/login");
}

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
          <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
            <HugeiconsIcon icon={Logout01Icon} size={16} />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppMobileNav({
  pathname,
  leagues,
  account,
}: {
  pathname: string;
  leagues: UserLeagueNavItem[];
  account: AppAccountSummary;
}) {
  const [open, setOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [showLeagues, setShowLeagues] = useState(false);
  const settingsActive = pathname.startsWith("/settings");

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
            onClick={() => setShowLeagues(false)}
          />
        }
      >
        <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-72 flex-col gap-0 overflow-hidden p-0 sm:max-w-xs"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="sr-only">Main menu</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate Fantasy Kings
          </SheetDescription>
          <SheetClose
            nativeButton={false}
            render={
              <Link
                href="/dashboard"
                className="w-fit"
                aria-label="Fantasy Kings home"
              />
            }
          >
            <Image
              src="/fk-logo-linear.svg"
              alt="Fantasy Kings"
              width={105}
              height={40}
              loading="eager"
            />
          </SheetClose>
        </SheetHeader>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <nav
            aria-label="Mobile main navigation"
            aria-hidden={showLeagues}
            inert={showLeagues}
            className={cn(
              "absolute inset-0 flex flex-col gap-1 overflow-y-auto p-4 transition-transform duration-200 ease-out",
              showLeagues
                ? "pointer-events-none -translate-x-full"
                : "translate-x-0",
            )}
          >
            {appNavItems.map((item) => {
              const active = item.isActive(pathname);

              if (item.href === "/leagues") {
                return (
                  <Button
                    key={item.href}
                    type="button"
                    variant="ghost"
                    aria-current={active ? "page" : undefined}
                    aria-expanded={showLeagues}
                    className={cn(
                      "h-10 w-full justify-start gap-2 px-0! font-semibold",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground",
                    )}
                    onClick={() => setShowLeagues(true)}
                  >
                    <HugeiconsIcon
                      icon={item.icon}
                      strokeWidth={active ? 2 : 1.75}
                      data-icon="inline-start"
                    />
                    <span className="truncate">{item.label}</span>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      strokeWidth={2}
                      className="ml-auto"
                      data-icon="inline-end"
                    />
                  </Button>
                );
              }

              return (
                <SheetClose
                  key={item.href}
                  nativeButton={false}
                  render={
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center gap-2 rounded-md text-sm font-semibold transition-colors",
                        active
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    />
                  }
                >
                  <HugeiconsIcon
                    icon={item.icon}
                    size={16}
                    strokeWidth={active ? 2 : 1.75}
                  />
                  <span className="truncate">{item.label}</span>
                </SheetClose>
              );
            })}
          </nav>

          <nav
            aria-label="Your leagues"
            aria-hidden={!showLeagues}
            inert={!showLeagues}
            className={cn(
              "absolute inset-0 flex flex-col gap-1 overflow-y-auto p-4 transition-transform duration-200 ease-out",
              showLeagues
                ? "translate-x-0"
                : "pointer-events-none translate-x-full",
            )}
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full justify-start gap-2 px-0!"
              onClick={() => setShowLeagues(false)}
            >
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Back
            </Button>
            <Separator className="my-2" />
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full justify-start gap-2 px-0!"
              onClick={() => {
                setOpen(false);
                setJoinOpen(true);
              }}
            >
              <HugeiconsIcon
                icon={Link01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Join League
            </Button>
            <SheetClose
              nativeButton={false}
              render={
                <Link
                  href="/leagues/create"
                  className={buttonVariants({
                    variant: "ghost",
                    className: "h-10 w-full justify-start gap-2 px-0!",
                  })}
                />
              }
            >
              <HugeiconsIcon
                icon={Add01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Create League
            </SheetClose>
            <Separator className="my-2" />
            {leagues.length > 0 ? (
              leagues.map((league) => (
                <SheetClose
                  key={league.id}
                  nativeButton={false}
                  render={
                    <Link
                      href={`/league/${league.publicId}`}
                      className="flex items-center gap-3 rounded-md py-2 text-sm transition-colors hover:bg-muted/50"
                    />
                  }
                >
                  <Avatar size="lg" className="size-10 shrink-0 text-xs">
                    {league.logoUrl ? (
                      <AvatarImage src={league.logoUrl} alt="" />
                    ) : null}
                    <AvatarFallback>{teamInitials(league.name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold text-foreground">
                      {league.name}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {league.teamName ?? "No team"}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatRecord(league.wins, league.losses, league.ties)}
                  </span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={16}
                    strokeWidth={2}
                    className="shrink-0 text-muted-foreground"
                  />
                </SheetClose>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                You haven&apos;t joined a league yet.
              </p>
            )}
          </nav>
        </div>

        {account ? (
          <div className="mt-auto flex shrink-0 flex-col gap-1 border-t p-4">
            <SheetClose
              nativeButton={false}
              render={
                <Link
                  href="/settings"
                  aria-current={settingsActive ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-md text-sm font-semibold transition-colors",
                    settingsActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                />
              }
            >
              <HugeiconsIcon
                icon={Settings01Icon}
                size={16}
                strokeWidth={settingsActive ? 2 : 1.75}
              />
              <span className="truncate">Account Settings</span>
            </SheetClose>
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full justify-start gap-2 px-0! font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setOpen(false);
                void handleSignOut();
              }}
            >
              <HugeiconsIcon
                icon={Logout01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Log Out
            </Button>
          </div>
        ) : null}
        </SheetContent>
      </Sheet>
      <JoinLeagueDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        showTrigger={false}
      />
    </>
  );
}

export function AppTopNav({
  initialAccount,
  initialLeagues,
}: {
  initialAccount: AppAccountSummary;
  initialLeagues: UserLeagueNavItem[];
}) {
  const pathname = usePathname();
  const account = initialAccount;

  return (
    <header className="app-chrome-nav fixed inset-x-0 top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <nav
        aria-label="Main navigation"
        className="relative flex h-14 w-full items-center px-4"
      >
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          <Link href="/dashboard" className="shrink-0">
            <Image
              src="/fk-logo-main.svg"
              alt="Fantasy Kings"
              width={120}
              height={120}
              loading="eager"
            />
          </Link>
        </div>

        <div className="pointer-events-none absolute inset-x-0 hidden justify-center md:flex">
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
              <div className="hidden md:block">
                <UserMenu
                  email={account.email}
                  avatarUrl={account.avatarUrl}
                  username={account.username}
                />
              </div>
            </>
          ) : (
            <Button
              nativeButton={false}
              render={
                <Link
                  href={`/login?next=${encodeURIComponent(pathname)}`}
                />
              }
              variant="ghost"
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
          <Separator
            orientation="vertical"
            className="mx-1 h-6 self-center data-vertical:h-6 data-vertical:self-center md:hidden"
          />
          <AppMobileNav
            pathname={pathname}
            leagues={initialLeagues}
            account={account}
          />
        </div>
      </nav>
    </header>
  );
}
