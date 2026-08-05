import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight01Icon, CalendarBlock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScheduleTeamLogo } from "@/components/scores/schedule-team-logo";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import type { EspnSeasonType, ScheduleGame, ScheduleTeam } from "@/lib/espn/scoreboard";
import {
  dayKey,
  formatKickoffDay,
  formatKickoffTime,
} from "@/lib/nfl/schedule-week";
import { cn } from "@/lib/utils";

type ScheduleListProps = {
  games: ScheduleGame[];
  week: number;
  seasonType?: EspnSeasonType;
};

function TeamBlock({
  team,
  showScore,
}: {
  team: ScheduleTeam;
  showScore: boolean;
}) {
  return (
    <div className="flex w-[154px] shrink-0 items-center gap-2.5">
      <ScheduleTeamLogo src={team.logoUrl} size={24} className="size-6" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs leading-tight text-muted-foreground">
          {team.city}
          <span className="tabular-nums"> ({team.record})</span>
        </p>
        <p
          className={cn(
            "truncate text-sm font-semibold leading-tight",
            showScore && team.winner === false && "text-muted-foreground",
          )}
        >
          {team.nickname}
          {showScore ? (
            <span className="ml-2 tabular-nums">{team.score ?? 0}</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function MatchupCell({ game }: { game: ScheduleGame }) {
  const showScore = game.status !== "pre";

  return (
    <div className="flex items-center py-1">
      <TeamBlock team={game.away} showScore={showScore} />
      <span className="ml-3 mr-6 shrink-0 text-muted-foreground">@</span>
      <TeamBlock team={game.home} showScore={showScore} />
    </div>
  );
}

function gameHref(
  gameId: string,
  week: number,
  seasonType: EspnSeasonType,
) {
  const params = new URLSearchParams({
    week: String(week),
    seasontype: String(seasonType),
  });
  return `/scores/${gameId}?${params.toString()}`;
}

function StatusCell({ game }: { game: ScheduleGame }) {
  const kickoff = new Date(game.kickoff);

  if (game.status === "in") {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="destructive" className="w-fit">
          Live
        </Badge>
        <span className="text-xs text-muted-foreground">{game.statusText}</span>
        {game.network ? (
          <span className="text-xs text-muted-foreground">{game.network}</span>
        ) : null}
      </div>
    );
  }

  if (game.status === "post") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">Final</span>
        {game.network ? (
          <span className="text-xs text-muted-foreground">{game.network}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium">{formatKickoffTime(kickoff)}</span>
      {game.network ? (
        <span className="text-xs text-muted-foreground">{game.network}</span>
      ) : null}
    </div>
  );
}

/** Compact per-game card row used on mobile. */
function MobileGameRow({
  game,
  week,
  seasonType,
}: {
  game: ScheduleGame;
  week: number;
  seasonType: EspnSeasonType;
}) {
  const showScore = game.status !== "pre";
  const kickoff = new Date(game.kickoff);

  return (
    <li className="flex items-center gap-3 border-b border-border/60 px-3 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {[game.away, game.home].map((team) => (
          <div key={team.abbreviation} className="flex items-center gap-2">
            <ScheduleTeamLogo src={team.logoUrl} size={20} className="size-5" />
            <span
              className={cn(
                "truncate text-sm font-semibold",
                showScore && team.winner === false && "text-muted-foreground",
              )}
            >
              {team.nickname}
            </span>
            <span className="ml-auto shrink-0 text-sm tabular-nums text-muted-foreground">
              {showScore ? (team.score ?? 0) : team.record}
            </span>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right whitespace-nowrap">
        {game.status === "in" ? (
          <>
            <Badge variant="destructive">Live</Badge>
            <span className="text-[11px] text-muted-foreground">
              {game.statusText}
            </span>
          </>
        ) : (
          <span className="text-xs font-medium tabular-nums">
            {game.status === "post" ? "Final" : formatKickoffTime(kickoff)}
          </span>
        )}
        {game.network ? (
          <span className="text-[11px] text-muted-foreground">
            {game.network}
          </span>
        ) : null}
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        nativeButton={false}
        aria-label={`View ${game.away.nickname} at ${game.home.nickname}`}
        render={<Link href={gameHref(game.id, week, seasonType)} />}
      >
        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
      </Button>
    </li>
  );
}

function LocationCell({ game }: { game: ScheduleGame }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{game.venue}</p>
      {game.venueLocation ? (
        <p className="truncate text-xs text-muted-foreground">
          {game.venueLocation}
        </p>
      ) : null}
    </div>
  );
}

export function ScheduleList({
  games,
  week,
  seasonType = 2,
}: ScheduleListProps) {
  if (games.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={CalendarBlock01Icon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>No games scheduled</EmptyTitle>
          <EmptyDescription>
            NFL games for this week will appear here when the schedule is set.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const groups = new Map<string, { label: string; games: ScheduleGame[] }>();

  for (const game of games) {
    const kickoff = new Date(game.kickoff);
    const key = dayKey(kickoff);
    const existing = groups.get(key);
    if (existing) {
      existing.games.push(game);
    } else {
      groups.set(key, {
        label: formatKickoffDay(kickoff),
        games: [game],
      });
    }
  }

  const days = [...groups.entries()];

  return (
    <>
      <div className="flex flex-col gap-5 md:hidden">
        {days.map(([key, group]) => (
          <section key={key} className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">{group.label}</h2>
            <ul className="flex flex-col rounded-xl border bg-card/40">
              {group.games.map((game) => (
                <MobileGameRow
                  key={game.id}
                  game={game}
                  week={week}
                  seasonType={seasonType}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <TableShell className="max-md:hidden">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[44%]" />
            <col className="w-[17%]" />
            <col className="w-[22%]" />
            <col className="w-[11%]" />
            <col className="w-[6%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>Matchup</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Odds</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map(([key, group], index) => (
              <Fragment key={key}>
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={5}
                    className={cn(
                      "border-b-0 px-2 text-sm font-medium whitespace-normal text-muted-foreground",
                      index === 0 ? "pt-2" : "pt-6",
                    )}
                  >
                    {group.label}
                  </TableCell>
                </TableRow>
                {group.games.map((game) => (
                  <TableRow key={game.id}>
                    <TableCell className="whitespace-normal">
                      <MatchupCell game={game} />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <StatusCell game={game} />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <LocationCell game={game} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {game.odds ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        nativeButton={false}
                        aria-label={`View ${game.away.nickname} at ${game.home.nickname}`}
                        render={
                          <Link href={gameHref(game.id, week, seasonType)} />
                        }
                      >
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          strokeWidth={2}
                        />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </TableShell>
    </>
  );
}
