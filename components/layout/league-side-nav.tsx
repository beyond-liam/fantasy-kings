"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { getLeagueNavItems, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type LeagueSideNavProps = {
  slug: string;
  isCommissioner: boolean;
  tradesAttention?: boolean;
};

function NavLink({
  item,
  pathname,
  showAttention,
}: {
  item: NavItem;
  pathname: string;
  showAttention?: boolean;
}) {
  const active = item.isActive(pathname);

  return (
    <Link
      href={item.href}
      aria-label={
        showAttention ? `${item.label} — action needed` : item.label
      }
      className={cn(
        "group relative flex min-h-16 shrink-0 flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs font-medium transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {showAttention ? (
        <span
          className="absolute top-2 right-2 size-2 rounded-full bg-destructive"
          aria-hidden
        />
      ) : null}
      <HugeiconsIcon
        icon={item.icon}
        size={20}
        strokeWidth={active ? 2 : 1.75}
        className="transition-[color] duration-150 ease-out"
      />
      <span className="truncate text-center">{item.shortLabel}</span>
    </Link>
  );
}

export function LeagueSideNav({
  slug,
  isCommissioner,
  tradesAttention = false,
}: LeagueSideNavProps) {
  const pathname = usePathname();
  const navItems = getLeagueNavItems(slug).filter(
    (item) => !item.commissionerOnly || isCommissioner,
  );

  return (
    <nav
      aria-label="League navigation"
      className="league-side-nav fixed top-14 left-0 z-40 h-[calc(100dvh-3.5rem)] w-[4.5rem] border-r border-border bg-background"
    >
      <ScrollArea className="h-full">
        <div className="flex flex-col">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              showAttention={
                item.href.endsWith("/trades") ? tradesAttention : false
              }
            />
          ))}
        </div>
      </ScrollArea>
    </nav>
  );
}
