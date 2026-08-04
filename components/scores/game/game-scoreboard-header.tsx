import { Fragment } from "react";
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
  showScore,
}: {
  side: ScheduleGame["away"];
  align: "left" | "right";
  showScore: boolean;
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
      {showScore ? (
        <p
          className={cn(
            "shrink-0 text-3xl font-semibold tabular-nums tracking-tight",
            side.winner === false && "text-muted-foreground",
          )}
        >
          {side.score ?? 0}
        </p>
      ) : null}
    </div>
  );
}

/** Compact ESPN-style bar: logo · abbrev + score/record · kickoff · abbrev · logo. */
function MobileScoreboard({ game }: GameScoreboardHeaderProps) {
  const kickoff = new Date(game.kickoff);
  const showScore = game.status !== "pre";

  return (
    <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-3 shadow-xs ring-1 ring-foreground/10 md:hidden">
      {([game.away, game.home] as const).map((side, index) => {
        const isHome = index === 1;
        const logo = (
          <ScheduleTeamLogo
            src={side.logoUrl}
            size={40}
            className="size-10"
          />
        );

        return (
          <Fragment key={side.abbreviation}>
            {isHome ? (
              <div className="flex shrink-0 flex-col items-center gap-0.5 px-1 text-center">
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
                    <Badge
                      variant={game.status === "in" ? "default" : "secondary"}
                    >
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
            ) : null}

            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2",
                isHome && "flex-row-reverse",
              )}
            >
              {logo}
              <div className="min-w-0 text-center">
                <p className="truncate text-sm font-semibold">
                  {side.abbreviation}
                </p>
                <p
                  className={cn(
                    "text-xs tabular-nums text-muted-foreground",
                    showScore &&
                      side.winner !== false &&
                      "text-base font-semibold text-foreground",
                  )}
                >
                  {showScore ? (side.score ?? 0) : side.record}
                </p>
              </div>
            </div>
          </Fragment>
        );
      })}
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
          <TeamSide side={game.away} align="left" showScore={showScore} />

          <div className="flex shrink-0 flex-col items-center gap-1 px-2 text-center">
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

          <TeamSide side={game.home} align="right" showScore={showScore} />
        </div>
      </div>
    </div>
  );
}
