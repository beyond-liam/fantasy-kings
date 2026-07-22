import Link from "next/link";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ScheduleGame } from "@/lib/espn/scoreboard";
import { formatKickoffDay, formatKickoffTime } from "@/lib/nfl/schedule-week";
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
      <img
        src={side.logoUrl}
        alt=""
        width={48}
        height={48}
        className="size-12 shrink-0"
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
          Back to schedule
        </Button>
      </div>

      <div className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <TeamSide side={game.away} align="left" showScore={showScore} />

          <div className="flex shrink-0 flex-col items-center gap-1 px-2 text-center">
            {game.status === "pre" ? (
              <>
                <p className="text-sm font-medium tabular-nums">
                  {formatKickoffTime(kickoff)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatKickoffDay(kickoff)}
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
            <p className="text-xs text-muted-foreground">
              {game.away.abbreviation} @ {game.home.abbreviation}
            </p>
          </div>

          <TeamSide side={game.home} align="right" showScore={showScore} />
        </div>
      </div>
    </div>
  );
}
