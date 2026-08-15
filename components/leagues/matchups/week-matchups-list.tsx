"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { AmericanFootballIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { MatchupStatusBadge } from "@/components/leagues/matchups/matchup-status-badge";
import { LIVE_SCORES_BOARD_EVENT } from "@/components/scores/live-refresh";
import {
  WeekFilter,
  type WeekFilterOption,
} from "@/components/scores/week-filter";
import { YearFilter } from "@/components/scores/year-filter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { formatRecord, teamInitials } from "@/lib/leagues/standings";
import { leagueMatchupPath } from "@/lib/leagues/utils";
import {
  winChanceFillClass,
  winChanceTextClass,
} from "@/lib/leagues/win-probability";
import type { MatchupBoardGame } from "@/lib/queries/week-matchup-board";
import type {
  MatchupBoardLiveGamePatch,
  MatchupBoardLivePatch,
} from "@/lib/leagues/matchups/board-live-patch";
import { cn } from "@/lib/utils";

type WeekMatchupsListProps = {
  games: MatchupBoardGame[];
  week: number;
  weeks: WeekFilterOption[];
  year: number;
  years: number[];
  leagueSlug: string;
  myTeamSlug?: string | null;
};

type MatchupsWeekYearFiltersProps = {
  week: number;
  weeks: WeekFilterOption[];
  year: number;
  years: number[];
  className?: string;
};

export function MatchupsWeekYearFilters({
  week,
  weeks,
  year,
  years,
  className,
}: MatchupsWeekYearFiltersProps) {
  if (weeks.length === 0 && years.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex shrink-0 gap-2", className)}>
      <Suspense fallback={<Spinner />}>
        {weeks.length > 0 ? <WeekFilter weeks={weeks} value={week} /> : null}
        {years.length > 0 ? <YearFilter years={years} value={year} /> : null}
      </Suspense>
    </div>
  );
}


const PLACEHOLDER = "—";
const CHANCE_ANIM_MS = 750;

function mergeBoardGame(
  game: MatchupBoardGame,
  patch: MatchupBoardLiveGamePatch,
): MatchupBoardGame {
  return {
    ...game,
    status: patch.status,
    resultFinal: patch.resultFinal,
    away: {
      ...game.away,
      actualPts: patch.away.actualPts,
      projectedPts: patch.away.projectedPts,
      winChance: patch.away.winChance,
      isLoser: patch.away.isLoser,
    },
    home: {
      ...game.home,
      actualPts: patch.home.actualPts,
      projectedPts: patch.home.projectedPts,
      winChance: patch.home.winChance,
      isLoser: patch.home.isLoser,
    },
  };
}

function applyBoardPatch(
  games: MatchupBoardGame[],
  patch: MatchupBoardLivePatch,
): MatchupBoardGame[] {
  if (patch.games.length === 0) {
    return games;
  }
  const byId = new Map(patch.games.map((game) => [game.id, game]));
  return games.map((game) => {
    const next = byId.get(game.id);
    return next ? mergeBoardGame(game, next) : game;
  });
}

function formatPts(value: number | null, digits = 2) {
  if (value == null || !Number.isFinite(value)) {
    return PLACEHOLDER;
  }
  return value.toFixed(digits);
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Shared 0→1 entrance progress for bar + ticking % (same finish time). */
function useChanceEntrance(targetPct: number | null) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (targetPct == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the rAF-driven animation state before (re)starting the entrance animation loop below.
      setProgress(0);
      return;
    }
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }

    setProgress(0);
    let raf = 0;
    const start = performance.now();

    const frame = (now: number) => {
      const raw = Math.min(1, (now - start) / CHANCE_ANIM_MS);
      setProgress(easeOutCubic(raw));
      if (raw < 1) {
        raf = requestAnimationFrame(frame);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [targetPct]);

  return progress;
}

function WinChanceMeter({
  chance,
  growFrom,
  align,
  muted,
}: {
  chance: number | null;
  growFrom: "end" | "start";
  align: "away" | "home";
  muted: boolean;
}) {
  const targetPct =
    chance != null && Number.isFinite(chance)
      ? Math.max(0, Math.min(100, Math.round(chance * 100)))
      : null;
  const progress = useChanceEntrance(targetPct);
  const displayPct =
    targetPct == null ? null : Math.round(progress * targetPct);
  const scale = targetPct == null ? 0 : (progress * targetPct) / 100;

  const fillTone = winChanceFillClass(chance);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={displayPct ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Win chance"
      >
        <div
          className={cn(
            "h-full w-full rounded-full",
            growFrom === "end" ? "origin-right" : "origin-left",
            fillTone,
          )}
          style={{ transform: `scaleX(${scale})` }}
        />
      </div>

      <div
        className={cn(
          "text-xs tabular-nums",
          align === "away" ? "text-right" : "text-left",
          muted ? "text-muted-foreground/70" : winChanceTextClass(chance),
        )}
      >
        {displayPct == null ? PLACEHOLDER : `${displayPct}%`}
      </div>
    </div>
  );
}

function MatchupSide({
  side,
  align,
}: {
  side: MatchupBoardGame["away"];
  align: "away" | "home";
}) {
  const isAway = align === "away";
  const muted = side.isLoser;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 py-3 sm:px-4">
      <div
        className={cn(
          "flex min-w-0 items-center gap-2.5",
          // Mobile: avatar → name → score. Desktop home mirrors.
          isAway ? "flex-row" : "flex-row md:flex-row-reverse",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5",
            isAway ? "flex-row" : "flex-row md:flex-row-reverse",
          )}
        >
          <Avatar size="default" className="shrink-0">
            {side.logoUrl ? <AvatarImage src={side.logoUrl} alt="" /> : null}
            <AvatarFallback>{teamInitials(side.teamName)}</AvatarFallback>
          </Avatar>
          <div
            className={cn(
              "flex min-w-0 flex-col text-left",
              !isAway && "md:text-right",
            )}
          >
            <span
              className={cn(
                "truncate text-sm font-semibold",
                muted ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {side.teamName}
            </span>
            <span
              className={cn(
                "truncate text-xs tabular-nums text-muted-foreground",
                muted && "text-muted-foreground/70",
              )}
            >
              {formatRecord(side.wins, side.losses, side.ties)}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "shrink-0 text-right tabular-nums",
            !isAway && "md:text-left",
            muted && "text-muted-foreground",
          )}
        >
          <div
            className={cn(
              "text-lg font-semibold leading-none tracking-tight sm:text-xl",
              muted && "text-muted-foreground",
            )}
          >
            {formatPts(side.actualPts, 1)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatPts(side.projectedPts)}
          </div>
        </div>
      </div>

      {/* Stacked mobile: meters grow L→R, % sits under the scores (right). */}
      <div className="md:hidden">
        <WinChanceMeter
          chance={side.winChance}
          growFrom="start"
          align="away"
          muted={muted}
        />
      </div>
      <div className="hidden md:block">
        <WinChanceMeter
          chance={side.winChance}
          growFrom={isAway ? "end" : "start"}
          align={align}
          muted={muted}
        />
      </div>
    </div>
  );
}

function MatchupBoardRow({
  game,
  leagueSlug,
}: {
  game: MatchupBoardGame;
  leagueSlug: string;
}) {
  return (
    <Link
      href={leagueMatchupPath(leagueSlug, game.publicId || game.id)}
      aria-label={`View matchup: ${game.away.teamName} vs ${game.home.teamName}`}
      className="relative flex min-w-0 flex-col items-stretch overflow-hidden rounded-xl border bg-card pt-7 transition-colors outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:flex-row"
    >
      <span className="pointer-events-none absolute inset-x-0 top-1.5 z-20 flex justify-center">
        <MatchupStatusBadge status={game.status} />
      </span>

      <div className="border-b border-border md:contents md:border-0">
        <MatchupSide side={game.away} align="away" />
      </div>

      <div className="relative z-10 hidden shrink-0 items-center self-center md:flex">
        <span className="flex size-8 items-center justify-center rounded-full border bg-background text-[10px] font-semibold tracking-wide text-muted-foreground">
          VS
        </span>
      </div>

      <MatchupSide side={game.home} align="home" />
    </Link>
  );
}

export function WeekMatchupsList({
  games,
  week,
  weeks,
  year,
  years,
  leagueSlug,
  myTeamSlug,
}: WeekMatchupsListProps) {
  const [liveGames, setLiveGames] = useState(games);
  const [prevGames, setPrevGames] = useState(games);

  if (games !== prevGames) {
    setPrevGames(games);
    setLiveGames(games);
  }

  useEffect(() => {
    const onPatch = (event: Event) => {
      const detail = (event as CustomEvent<MatchupBoardLivePatch>).detail;
      if (!detail?.games) {
        return;
      }
      setLiveGames((prev) => applyBoardPatch(prev, detail));
    };
    window.addEventListener(LIVE_SCORES_BOARD_EVENT, onPatch);
    return () => {
      window.removeEventListener(LIVE_SCORES_BOARD_EVENT, onPatch);
    };
  }, []);

  const myGame =
    myTeamSlug != null && myTeamSlug !== ""
      ? (liveGames.find(
          (game) =>
            game.away.teamSlug === myTeamSlug ||
            game.home.teamSlug === myTeamSlug,
        ) ?? null)
      : null;
  const otherGames = myGame
    ? liveGames.filter((game) => game.id !== myGame.id)
    : liveGames;

  const filters = (
    <MatchupsWeekYearFilters
      week={week}
      weeks={weeks}
      year={year}
      years={years}
      className="md:order-last"
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {liveGames.length === 0 ? (
        <>
          {filters}
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={AmericanFootballIcon} strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>No matchups for Week {week}</EmptyTitle>
              <EmptyDescription>
                Generate the schedule when the league is full.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </>
      ) : (
        <div className="flex flex-col gap-8">
          {myGame ? (
            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                {filters}
                <h2 className="text-sm font-medium">Your Matchup</h2>
              </div>
              <MatchupBoardRow game={myGame} leagueSlug={leagueSlug} />
            </section>
          ) : null}

          {otherGames.length > 0 ? (
            <section className="flex flex-col gap-3">
              {!myGame ? (
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  {filters}
                  <h2 className="text-sm font-medium">Matchups</h2>
                </div>
              ) : (
                <h2 className="text-sm font-medium">Other Matchups</h2>
              )}
              <ul className="flex flex-col gap-3">
                {otherGames.map((game) => (
                  <li key={game.id}>
                    <MatchupBoardRow game={game} leagueSlug={leagueSlug} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
