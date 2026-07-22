"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";

import {
  WeekFilter,
  type WeekFilterOption,
} from "@/components/scores/week-filter";
import { YearFilter } from "@/components/scores/year-filter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { formatRecord, teamInitials } from "@/lib/leagues/standings";
import { leagueMatchupPath } from "@/lib/leagues/utils";
import type { MatchupBoardGame } from "@/lib/queries/week-matchup-board";
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

const PLACEHOLDER = "—";
const CHANCE_ANIM_MS = 750;

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

  const fillTone =
    chance == null
      ? "bg-muted-foreground/40"
      : chance >= 0.55
        ? "bg-success"
        : chance <= 0.45
          ? "bg-destructive"
          : "bg-muted-foreground";

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
          muted && "text-muted-foreground/70",
          !muted && chance != null && chance >= 0.55 && "text-success",
          !muted && chance != null && chance <= 0.45 && "text-destructive",
          !muted &&
            (chance == null || (chance > 0.45 && chance < 0.55)) &&
            "text-muted-foreground",
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
          isAway ? "flex-row" : "flex-row-reverse",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5",
            isAway ? "flex-row" : "flex-row-reverse",
          )}
        >
          <Avatar size="default" className="shrink-0">
            {side.logoUrl ? <AvatarImage src={side.logoUrl} alt="" /> : null}
            <AvatarFallback>{teamInitials(side.teamName)}</AvatarFallback>
          </Avatar>
          <div
            className={cn(
              "flex min-w-0 flex-col",
              isAway ? "text-left" : "text-right",
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
            "shrink-0 tabular-nums",
            isAway ? "text-right" : "text-left",
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

      <WinChanceMeter
        chance={side.winChance}
        growFrom={isAway ? "end" : "start"}
        align={align}
        muted={muted}
      />
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
      href={leagueMatchupPath(leagueSlug, game.id)}
      aria-label={`View matchup: ${game.away.teamName} vs ${game.home.teamName}`}
      className="relative flex min-w-0 items-stretch overflow-hidden rounded-xl border bg-card transition-colors outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <MatchupSide side={game.away} align="away" />

      <div className="relative z-10 flex shrink-0 items-center self-center">
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
  const myGame =
    myTeamSlug != null && myTeamSlug !== ""
      ? (games.find(
          (game) =>
            game.away.teamSlug === myTeamSlug ||
            game.home.teamSlug === myTeamSlug,
        ) ?? null)
      : null;
  const otherGames = myGame
    ? games.filter((game) => game.id !== myGame.id)
    : games;

  const filters =
    weeks.length > 0 || years.length > 0 ? (
      <div className="flex shrink-0 justify-end gap-2">
        <Suspense fallback={<Spinner />}>
          {weeks.length > 0 ? <WeekFilter weeks={weeks} value={week} /> : null}
          {years.length > 0 ? <YearFilter years={years} value={year} /> : null}
        </Suspense>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      {games.length === 0 ? (
        <>
          {filters ? <div className="flex justify-end">{filters}</div> : null}
          <p className="text-sm text-pretty text-muted-foreground">
            No matchups for Week {week}. Generate the schedule when the league is
            full.
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-8">
          {myGame ? (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-sm font-medium">Your Matchup</h2>
                {filters}
              </div>
              <MatchupBoardRow game={myGame} leagueSlug={leagueSlug} />
            </section>
          ) : filters ? (
            <div className="flex justify-end">{filters}</div>
          ) : null}

          {otherGames.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-sm font-medium">
                  {myGame ? "Other Matchups" : "Matchups"}
                </h2>
                {!myGame ? filters : null}
              </div>
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
