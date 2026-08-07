import Link from "next/link";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScheduleTeamLogo } from "@/components/scores/schedule-team-logo";
import type { ScheduleGame } from "@/lib/espn/scoreboard";
import {
  formatKickoffDayShort,
  formatKickoffTime,
} from "@/lib/nfl/schedule-week";
import { cn } from "@/lib/utils";

type GameScoreboardHeaderProps = {
  game: ScheduleGame;
};

function TeamSide({
  side,
  align,
}: {
  side: ScheduleGame["away"];
  align: "left" | "right";
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
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{side.city}</p>
        <p className="truncate text-lg font-semibold tracking-tight">
          {side.nickname}
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {side.record}
        </p>
      </div>
    </div>
  );
}

function ScoreValue({
  side,
}: {
  side: ScheduleGame["away"];
}) {
  return (
    <p
      className={cn(
        "shrink-0 text-3xl font-bold tabular-nums tracking-tight",
        side.winner === false && "text-muted-foreground",
      )}
    >
      {side.score ?? 0}
    </p>
  );
}

/** Compact bar: logo · abbrev · score · status · score · abbrev · logo. */
function MobileScoreboard({ game }: GameScoreboardHeaderProps) {
  const kickoff = new Date(game.kickoff);
  const showScore = game.status !== "pre";

  return (
    <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-3 shadow-xs ring-1 ring-foreground/10 md:hidden">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ScheduleTeamLogo
          src={game.away.logoUrl}
          size={40}
          className="size-10"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {game.away.abbreviation}
          </p>
          {!showScore ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {game.away.record}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {showScore ? (
          <p
            className={cn(
              "text-xl font-bold tabular-nums tracking-tight",
              game.away.winner === false && "text-muted-foreground",
            )}
          >
            {game.away.score ?? 0}
          </p>
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
          ) : (
            <>
              <Badge variant={game.status === "in" ? "default" : "secondary"}>
                {game.statusText}
              </Badge>
              {game.status === "in" && game.displayClock ? (
                <p className="text-xs tabular-nums text-muted-foreground">
                  {game.period ? `Q${game.period} ` : null}
                  {game.displayClock}
                </p>
              ) : null}
            </>
          )}
        </div>
        {showScore ? (
          <p
            className={cn(
              "text-xl font-bold tabular-nums tracking-tight",
              game.home.winner === false && "text-muted-foreground",
            )}
          >
            {game.home.score ?? 0}
          </p>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-2 text-right">
        <ScheduleTeamLogo
          src={game.home.logoUrl}
          size={40}
          className="size-10"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {game.home.abbreviation}
          </p>
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
          <TeamSide side={game.away} align="left" />

          <div className="flex shrink-0 items-center gap-3 px-2">
            {showScore ? <ScoreValue side={game.away} /> : null}
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
              ) : (
                <>
                  <Badge
                    variant={game.status === "in" ? "default" : "secondary"}
                  >
                    {game.statusText}
                  </Badge>
                  {game.status === "in" && game.displayClock ? (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {game.period ? `Q${game.period}` : null}{" "}
                      {game.displayClock}
                    </p>
                  ) : null}
                </>
              )}
            </div>
            {showScore ? <ScoreValue side={game.home} /> : null}
          </div>

          <TeamSide side={game.home} align="right" />
        </div>
      </div>
    </div>
  );
}
