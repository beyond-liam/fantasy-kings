"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { Cancel01Icon, SearchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  DraftPlayerAction,
  type LeagueDraftTableActions,
} from "@/components/leagues/draft/draft-player-action";
import {
  PILL_CLASSNAME,
  PILL_INACTIVE_CLASSNAME,
} from "@/components/rankings/filter-pills";
import { PlayerActionButton } from "@/components/rankings/player-action-button";
import { PlayerIdentity } from "@/components/rankings/player-identity";
import { WatchlistToggle } from "@/components/rankings/watchlist-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import type { PlayerSearchRow } from "@/lib/rankings/player-search";
import { PLAYER_SEARCH_PAGE_SIZE } from "@/lib/rankings/player-search";
import type { ScoringPreset } from "@/lib/leagues/scoring";
import { cn } from "@/lib/utils";

/** Gap between the panel and the viewport edges. */
const SHEET_INSET = "0.5rem";

export type PlayerSearchDrawerProps = {
  triggerClassName?: string;
  searchPlaceholder?: string;
  /** League slug — enables ownership actions + watchlist + league scoring. */
  leagueSlug?: string;
  season: string;
  scoring?: ScoringPreset;
  showWatchlist?: boolean;
  showActions?: boolean;
  actionsEnabled?: boolean;
  tradesEnabled?: boolean;
  acquisitionsLocked?: boolean;
  acquisitionLockReason?: string;
  draftActions?: LeagueDraftTableActions;
};

type SearchResponse = {
  players: PlayerSearchRow[];
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
  kind?: "projection" | "stats";
  actionsEnabled?: boolean;
  tradesEnabled?: boolean;
};

function buildSearchUrl(input: {
  leagueSlug?: string;
  season: string;
  scoring?: ScoringPreset;
  query: string;
  offset: number;
}) {
  const params = new URLSearchParams({
    offset: String(input.offset),
    limit: String(PLAYER_SEARCH_PAGE_SIZE),
  });
  if (input.query) params.set("q", input.query);
  if (input.season) params.set("season", input.season);
  if (input.scoring) params.set("scoring", input.scoring);

  if (input.leagueSlug) {
    return `/api/league/${encodeURIComponent(input.leagueSlug)}/players/search?${params}`;
  }
  return `/api/players/search?${params}`;
}

export function PlayerSearchDrawer({
  triggerClassName,
  searchPlaceholder = "Search players...",
  leagueSlug,
  season,
  scoring,
  showWatchlist = false,
  showActions = false,
  actionsEnabled = true,
  tradesEnabled = true,
  acquisitionsLocked,
  acquisitionLockReason,
  draftActions,
}: PlayerSearchDrawerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [players, setPlayers] = useState<PlayerSearchRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedActionsEnabled, setResolvedActionsEnabled] =
    useState(actionsEnabled);
  const [resolvedTradesEnabled, setResolvedTradesEnabled] =
    useState(tradesEnabled);

  const requestIdRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    void (async () => {
      await Promise.resolve();
      if (requestId !== requestIdRef.current) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          buildSearchUrl({
            leagueSlug,
            season,
            scoring,
            query: deferredQuery.trim(),
            offset: 0,
          }),
          { signal: controller.signal },
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Could not load players.");
        }

        const data = (await response.json()) as SearchResponse;
        if (requestId !== requestIdRef.current) return;

        setPlayers(data.players);
        setHasMore(data.hasMore);
        setTotal(data.total);
        if (typeof data.actionsEnabled === "boolean") {
          setResolvedActionsEnabled(data.actionsEnabled);
        }
        if (typeof data.tradesEnabled === "boolean") {
          setResolvedTradesEnabled(data.tradesEnabled);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        setPlayers([]);
        setHasMore(false);
        setTotal(0);
        setError(
          err instanceof Error ? err.message : "Could not load players.",
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [open, deferredQuery, leagueSlug, season, scoring]);

  useEffect(() => {
    if (!open || !hasMore || loading || loadingMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        const requestId = requestIdRef.current;
        const nextOffset = players.length;
        setLoadingMore(true);

        void fetch(
          buildSearchUrl({
            leagueSlug,
            season,
            scoring,
            query: deferredQuery.trim(),
            offset: nextOffset,
          }),
        )
          .then(async (response) => {
            if (!response.ok) {
              throw new Error("Could not load more players.");
            }
            return response.json() as Promise<SearchResponse>;
          })
          .then((data) => {
            if (requestId !== requestIdRef.current) return;
            setPlayers((current) => {
              const seen = new Set(current.map((player) => player.id));
              return [
                ...current,
                ...data.players.filter((player) => !seen.has(player.id)),
              ];
            });
            setHasMore(data.hasMore);
            setTotal(data.total);
          })
          .catch(() => {
            /* keep existing list; user can scroll again */
          })
          .finally(() => {
            if (requestId === requestIdRef.current) {
              setLoadingMore(false);
            }
          });
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    open,
    hasMore,
    loading,
    loadingMore,
    players.length,
    deferredQuery,
    leagueSlug,
    season,
    scoring,
  ]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setPlayers([]);
          setHasMore(false);
          setTotal(0);
          setError(null);
        }
      }}
    >
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Search players"
            className={cn(
              PILL_CLASSNAME,
              PILL_INACTIVE_CLASSNAME,
              "flex items-center",
              triggerClassName,
            )}
          />
        }
      >
        <HugeiconsIcon icon={SearchIcon} strokeWidth={2} size={16} />
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-xl border"
        style={{
          top: SHEET_INSET,
          bottom: SHEET_INSET,
          left: SHEET_INSET,
          right: SHEET_INSET,
        }}
      >
        <SheetHeader className="gap-3 border-b border-border p-2">
          <SheetTitle className="sr-only">Search players</SheetTitle>
          <SheetDescription className="sr-only">
            Search all players sorted by fantasy points
          </SheetDescription>
          <div className="flex items-center gap-2">
            <InputGroup className="h-10 flex-1">
              <InputGroupAddon align="inline-start">
                <HugeiconsIcon icon={SearchIcon} strokeWidth={2} />
              </InputGroupAddon>
              <InputGroupInput
                autoFocus
                placeholder={searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Clear search"
                    className="relative after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2"
                    onClick={() => setQuery("")}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            <SheetClose render={<Button variant="ghost" size="icon" />}>
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <Spinner />
              Loading players…
            </div>
          ) : error ? (
            <p className="px-4 py-10 text-center text-sm text-destructive">
              {error}
            </p>
          ) : players.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No players match your search.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {players.map((player) => {
                const isDrafted = draftActions
                  ? draftActions.draftedPlayerIds.includes(player.id) ||
                    Boolean(player.fantasyTeamId)
                  : false;

                return (
                <li
                  key={player.id}
                  className="flex items-center gap-2 px-3 py-2.5"
                >
                  {showActions && leagueSlug ? (
                    draftActions ? (
                      <DraftPlayerAction
                        slug={leagueSlug}
                        playerId={player.id}
                        drafted={isDrafted}
                        canDraft={
                          draftActions.draftLive &&
                          draftActions.isMyTurn &&
                          !isDrafted
                        }
                        canCommissionerPick={
                          draftActions.draftLive &&
                          draftActions.isCommissioner &&
                          !draftActions.isMyTurn &&
                          !isDrafted
                        }
                        disabledReason={
                          draftActions.draftLive && !draftActions.isMyTurn
                            ? "Waiting for your turn."
                            : "Draft has not started."
                        }
                      />
                    ) : (
                      <PlayerActionButton
                        player={player}
                        leagueSlug={leagueSlug}
                        disabled={!resolvedActionsEnabled}
                        tradesEnabled={resolvedTradesEnabled}
                        acquisitionsLocked={acquisitionsLocked}
                        acquisitionLockReason={acquisitionLockReason}
                      />
                    )
                  ) : null}
                  <PlayerIdentity
                    className="min-w-0 flex-1"
                    fullName={player.fullName}
                    sleeperId={player.sleeperId}
                    primaryPositionId={player.primaryPositionId}
                    nflTeam={player.nflTeam}
                    byeWeek={player.byeWeek}
                    injuryStatus={player.injuryStatus}
                    playerId={player.id}
                    leagueSlug={leagueSlug ?? null}
                  />
                  {showWatchlist && leagueSlug ? (
                    <WatchlistToggle playerId={player.id} />
                  ) : null}
                </li>
                );
              })}
            </ul>
          )}

          <div ref={sentinelRef} className="h-8" aria-hidden />
          {loadingMore ? (
            <div className="flex items-center justify-center gap-2 pb-6 text-sm text-muted-foreground">
              <Spinner />
              Loading more…
            </div>
          ) : null}
          {!loading && !loadingMore && players.length > 0 ? (
            <p className="px-4 pb-6 text-center text-xs text-muted-foreground">
              {players.length} of {total}
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
