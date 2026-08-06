"use client";

import { useEffect, useRef } from "react";
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
  messagesAttention?: boolean;
  /** Draft is live or paused — show pulsing live indicator on Draft. */
  draftLive?: boolean;
};

/** Small solid core + hollow ring that expands and fades out. */
function LivePulseDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-1.5 shrink-0 items-center justify-center",
        className,
      )}
      aria-hidden
    >
      <span className="animate-live-pulse absolute size-1.5 rounded-full border border-success bg-transparent" />
      <span className="relative size-1.5 rounded-full bg-success" />
    </span>
  );
}

function NavLink({
  item,
  pathname,
  showAttention,
  showLive,
  variant,
}: {
  item: NavItem;
  pathname: string;
  showAttention?: boolean;
  showLive?: boolean;
  variant: "rail" | "pill";
}) {
  const active = item.isActive(pathname);
  const pill = variant === "pill";
  const statusLabel = showLive
    ? `${item.label} — draft underway`
    : showAttention
      ? `${item.label} — action needed`
      : item.label;

  return (
    <Link
      href={item.href}
      aria-label={statusLabel}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex shrink-0 items-center justify-center transition-colors",
        pill
          ? "gap-1.5 rounded-sm px-2 py-1.5 text-xs font-semibold"
          : "min-h-16 flex-col gap-0.5 px-2 py-2 text-xs font-medium",
        active
          ? pill
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {showAttention && !showLive ? (
        <span
          className={cn(
            "absolute size-2 rounded-full bg-destructive",
            pill ? "top-1 right-1" : "top-2 right-2",
          )}
          aria-hidden
        />
      ) : null}
      <HugeiconsIcon
        icon={item.icon}
        size={pill ? 16 : 20}
        strokeWidth={active ? 2 : 1.75}
        className="transition-[color] duration-150 ease-out"
      />
      <span
        className={cn(
          "inline-flex items-center gap-1",
          pill ? "whitespace-nowrap" : "max-w-full justify-center",
        )}
      >
        <span className={cn(!pill && "truncate text-center")}>
          {item.shortLabel}
        </span>
        {showLive ? <LivePulseDot /> : null}
      </span>
    </Link>
  );
}

export function LeagueSideNav({
  slug,
  isCommissioner,
  tradesAttention = false,
  messagesAttention = false,
  draftLive = false,
}: LeagueSideNavProps) {
  const pathname = usePathname();
  const pillScrollerRef = useRef<HTMLDivElement>(null);
  const navItems = getLeagueNavItems(slug).filter(
    (item) => !item.commissionerOnly || isCommissioner,
  );

  // Pill scroll resets to 0 on each navigation — recentre the active pill.
  useEffect(() => {
    const scroller = pillScrollerRef.current;
    const active = scroller?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!scroller || !active) return;

    const start = active.offsetLeft;
    const end = start + active.offsetWidth;
    const visibleStart = scroller.scrollLeft;
    const visibleEnd = visibleStart + scroller.clientWidth;
    if (start >= visibleStart && end <= visibleEnd) return;

    scroller.scrollLeft = Math.max(
      0,
      start - (scroller.clientWidth - active.offsetWidth) / 2,
    );
  }, [pathname]);

  const renderItems = (variant: "rail" | "pill") =>
    navItems.map((item) => {
      const showAttention = item.href.endsWith("/trades")
        ? tradesAttention
        : item.href.endsWith("/messages")
          ? messagesAttention
          : false;
      const showLive = item.href.endsWith("/draft") ? draftLive : false;

      return (
        <NavLink
          key={item.href}
          item={item}
          pathname={pathname}
          showAttention={showAttention}
          showLive={showLive}
          variant={variant}
        />
      );
    });

  return (
    <>
      <nav
        aria-label="League navigation"
        className="league-side-nav fixed top-14 left-0 z-40 hidden h-[calc(100dvh-3.5rem)] w-18 border-r border-border bg-background md:block"
      >
        <ScrollArea className="h-full">
          <div className="flex flex-col">{renderItems("rail")}</div>
        </ScrollArea>
      </nav>

      <nav
        aria-label="League navigation"
        className="sticky top-14 z-40 flex h-14 w-full items-center border-b border-border bg-background/95 backdrop-blur md:hidden supports-backdrop-filter:bg-background/80"
      >
        <div
          ref={pillScrollerRef}
          className="no-scrollbar flex h-full w-full items-center gap-1.5 overflow-x-auto px-4 overscroll-x-contain"
        >
          {renderItems("pill")}
        </div>
      </nav>
    </>
  );
}
