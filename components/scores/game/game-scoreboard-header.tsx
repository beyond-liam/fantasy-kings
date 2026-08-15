import Link from "next/link";
import {
  AmericanFootballIcon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScheduleTeamLogo } from "@/components/scores/schedule-team-logo";
import { LivePulseDot } from "@/components/live-pulse-dot";
import {
  formatLiveClockLabel,
  type ScheduleGame,
} from "@/lib/espn/scoreboard";
import {
  formatKickoffDayShort,
  formatKickoffTime,
} from "@/lib/nfl/schedule-week";
import { cn } from "@/lib/utils";

type GameScoreboardHeaderProps = {
  game: ScheduleGame;
};

function TimeoutDots({ remaining }: { remaining: number | null }) {
  if (remaining == null) return null;

  return (
    <div
      className="flex items-center justify-center gap-1"
      aria-label={`${remaining} timeout${remaining === 1 ? "" : "s"} remaining`}
    >
      {Array.from({ length: 3 }, (_, index) => (
        <span
          key={index}
          className={cn(
            "size-1.5 rounded-full",
            index < remaining ? "bg-orange-500" : "bg-slate-600",
          )}
        />
      ))}
    </div>
  );
}

function PossessionName({
  name,
  hasPossession,
  align,
  className,
}: {
  name: string;
  hasPossession: boolean;
  align: "left" | "right";
  className?: string;
}) {
  const icon = hasPossession ? (
    <>
      <HugeiconsIcon
        icon={AmericanFootballIcon}
        strokeWidth={2}
        className="size-3.5 shrink-0 text-success"
        aria-hidden
      />
      <span className="sr-only">has possession</span>
    </>
  ) : null;

  return (
    <p
      className={cn(
        "flex min-w-0 items-center gap-1",
        align === "right" && "justify-end",
        className,
      )}
    >
      {align === "right" ? icon : null}
      <span className="truncate">{name}</span>
      {align === "left" ? icon : null}
    </p>
  );
}

function LiveStatus({ game }: { game: ScheduleGame }) {
  const clock = formatLiveClockLabel(game);
  const downDistance = game.situation?.downDistance;

  return (
    <>
      <p className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-success">
        <LivePulseDot />
        <span>{clock ?? "Live"}</span>
      </p>
      {downDistance ? (
        <p className="max-w-28 text-xs leading-tight text-muted-foreground">
          {downDistance}
        </p>
      ) : null}
    </>
  );
}

function TeamSide({
  side,
  align,
  hasPossession,
}: {
  side: ScheduleGame["away"];
  align: "left" | "right";
  hasPossession: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-3",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <ScheduleTeamLogo
        src={side.logoUrl}
        size={48}
        className="size-12"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-xs leading-tight text-muted-foreground">
          {side.city}
        </p>
        <PossessionName
          name={side.nickname}
          hasPossession={hasPossession}
          align={align}
          className="text-lg font-semibold leading-tight tracking-tight"
        />
        <p className="text-xs tabular-nums text-muted-foreground">
          {side.record}
        </p>
      </div>
    </div>
  );
}

function ScoreValue({
  side,
  timeouts,
}: {
  side: ScheduleGame["away"];
  timeouts: number | null;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <p
        className={cn(
          "text-3xl font-bold tabular-nums tracking-tight",
          side.winner === false && "text-muted-foreground",
        )}
      >
        {side.score ?? 0}
      </p>
      <TimeoutDots remaining={timeouts} />
    </div>
  );
}

/** Compact bar: logo · abbrev · score · status · score · abbrev · logo. */
function MobileScoreboard({ game }: GameScoreboardHeaderProps) {
  const kickoff = new Date(game.kickoff);
  const showScore = game.status !== "pre";
  const live = game.status === "in";

  return (
    <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-3 shadow-xs ring-1 ring-foreground/10 md:hidden">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ScheduleTeamLogo
          src={game.away.logoUrl}
          size={40}
          className="size-10"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <PossessionName
            name={game.away.abbreviation}
            hasPossession={live && game.possession === "away"}
            align="left"
            className="text-sm font-semibold"
          />
          {!showScore ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {game.away.record}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {showScore ? (
          <div className="flex flex-col items-center gap-1">
            <p
              className={cn(
                "text-xl font-bold tabular-nums tracking-tight",
                game.away.winner === false && "text-muted-foreground",
              )}
            >
              {game.away.score ?? 0}
            </p>
            {live ? (
              <TimeoutDots remaining={game.situation?.awayTimeouts ?? null} />
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col items-center gap-0.5 text-center">
          {game.status === "pre" ? (
            <>
              <p className="text-sm font-semibold">
                {formatKickoffDayShort(kickoff)}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatKickoffTime(kickoff)}
              </p>
            </>
          ) : game.status === "in" ? (
            <LiveStatus game={game} />
          ) : (
            <Badge variant="secondary">{game.statusText}</Badge>
          )}
        </div>
        {showScore ? (
          <div className="flex flex-col items-center gap-1">
            <p
              className={cn(
                "text-xl font-bold tabular-nums tracking-tight",
                game.home.winner === false && "text-muted-foreground/60",
              )}
            >
              {game.home.score ?? 0}
            </p>
            {live ? (
              <TimeoutDots remaining={game.situation?.homeTimeouts ?? null} />
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-2 text-right">
        <ScheduleTeamLogo
          src={game.home.logoUrl}
          size={40}
          className="size-10"
        />
        <div className="flex min-w-0 flex-col gap-0.5 text-right">
          <PossessionName
            name={game.home.abbreviation}
            hasPossession={live && game.possession === "home"}
            align="right"
            className="text-sm font-semibold"
          />
          {!showScore ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {game.home.record}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function GameScoreboardHeader({ game }: GameScoreboardHeaderProps) {
  const kickoff = new Date(game.kickoff);
  const showScore = game.status !== "pre";
  const live = game.status === "in";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/scores" />}
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Back to Schedule
        </Button>
      </div>

      <MobileScoreboard game={game} />

      <div className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 max-md:hidden sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <TeamSide
            side={game.away}
            align="left"
            hasPossession={live && game.possession === "away"}
          />

          <div className="flex shrink-0 items-center gap-3 px-2">
            {showScore ? (
              <ScoreValue
                side={game.away}
                timeouts={live ? game.situation?.awayTimeouts ?? null : null}
              />
            ) : null}
            <div className="flex flex-col items-center gap-1 text-center">
              {game.status === "pre" ? (
                <>
                  <p className="text-sm font-medium tabular-nums">
                    {formatKickoffTime(kickoff)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatKickoffDayShort(kickoff)}
                  </p>
                </>
              ) : game.status === "in" ? (
                <LiveStatus game={game} />
              ) : (
                <Badge variant="secondary">{game.statusText}</Badge>
              )}
            </div>
            {showScore ? (
              <ScoreValue
                side={game.home}
                timeouts={live ? game.situation?.homeTimeouts ?? null : null}
              />
            ) : null}
          </div>

          <TeamSide
            side={game.home}
            align="right"
            hasPossession={live && game.possession === "home"}
          />
        </div>
      </div>
    </div>
  );
}
