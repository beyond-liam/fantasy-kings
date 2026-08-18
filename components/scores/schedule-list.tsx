import Link from "next/link";
import { AmericanFootballIcon, CalendarBlock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { AnimatedScore } from "@/components/ui/animated-score";
import { ScheduleTeamLogo } from "@/components/scores/schedule-team-logo";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  formatLiveMatchupLabel,
  type EspnSeasonType,
  type ScheduleGame,
  type ScheduleTeam,
} from "@/lib/espn/scoreboard";
import {
  formatKickoffDayShort,
  formatKickoffTime,
} from "@/lib/nfl/schedule-week";
import { cn } from "@/lib/utils";

type ScheduleListProps = {
  games: ScheduleGame[];
  week: number;
  seasonType?: EspnSeasonType;
};

const PLACEHOLDER = "—";
const SECTION_HEADER_CLASS =
  "text-[10px] font-medium tracking-wide text-muted-foreground uppercase";

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

/** Period labels for the linescore grid (1–4, OT…, F). */
function periodLabels(game: ScheduleGame): string[] {
  const count = Math.max(
    game.away.linescores.length,
    game.home.linescores.length,
    game.status === "pre" ? 0 : 4,
  );
  if (count === 0) {
    return ["1", "2", "3", "4", "F"];
  }

  const labels = Array.from({ length: count }, (_, index) => {
    if (index < 4) return String(index + 1);
    if (index === 4 && count === 5) return "OT";
    return `OT${index - 3}`;
  });
  labels.push("F");
  return labels;
}

function periodValue(
  team: ScheduleTeam,
  index: number,
  isTotal: boolean,
): string {
  if (isTotal) {
    return team.score != null ? String(team.score) : PLACEHOLDER;
  }
  if (index >= team.linescores.length) return PLACEHOLDER;
  return String(team.linescores[index]!);
}

function TeamIdentity({
  team,
  muted,
  hasPossession,
}: {
  team: ScheduleTeam;
  muted: boolean;
  hasPossession: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <ScheduleTeamLogo src={team.logoUrl} size={32} className="size-8" />
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-xs leading-tight text-muted-foreground",
            muted && "text-muted-foreground/70",
          )}
        >
          {team.city}
          <span className="tabular-nums"> ({team.record})</span>
        </p>
        <p
          className={cn(
            "flex min-w-0 items-center gap-1 text-sm font-semibold leading-tight",
            muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          <span className="truncate">{team.nickname}</span>
          {hasPossession ? (
            <>
              <HugeiconsIcon
                icon={AmericanFootballIcon}
                strokeWidth={2}
                className="size-3.5 shrink-0 text-success"
                aria-hidden
              />
              <span className="sr-only">has possession</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function ScoreCells({
  team,
  labels,
  muted,
}: {
  team: ScheduleTeam;
  labels: string[];
  muted: boolean;
}) {
  return (
    <>
      {labels.map((label, index) => {
        const isTotal = index === labels.length - 1;
        return (
          <span
            key={`${team.abbreviation}-${label}`}
            className={cn(
              "w-full text-center tabular-nums",
              isTotal
                ? "text-lg font-semibold tracking-tight"
                : "text-xs text-muted-foreground",
              muted && "text-muted-foreground/60",
              isTotal && !muted && "text-foreground",
            )}
          >
            {isTotal && team.score != null ? (
              <AnimatedScore value={team.score} />
            ) : (
              periodValue(team, index, isTotal)
            )}
          </span>
        );
      })}
    </>
  );
}

function ScheduleGameCard({
  game,
  week,
  seasonType,
}: {
  game: ScheduleGame;
  week: number;
  seasonType: EspnSeasonType;
}) {
  const kickoff = new Date(game.kickoff);
  const labels = periodLabels(game);
  const liveLabel = formatLiveMatchupLabel(game);
  const matchupHeader = liveLabel ?? "Matchup";
  const mobileHeader =
    liveLabel ??
    `${formatKickoffDayShort(kickoff)} · ${formatKickoffTime(kickoff)}`;

  return (
    <Link
      href={gameHref(game.id, week, seasonType)}
      aria-label={`View ${game.away.nickname} at ${game.home.nickname}`}
      className={cn(
        "grid min-w-0 gap-3 overflow-hidden rounded-xl border bg-card p-3 transition-colors outline-none",
        "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "grid-cols-1 md:gap-4 md:p-4",
        "xl:grid-cols-[minmax(0,1fr)_auto_minmax(10rem,13rem)] xl:items-stretch",
      )}
    >
      <div
        className="grid min-w-0 items-center gap-x-0.5 gap-y-1.5 xl:pr-10"
        style={{
          gridTemplateColumns: `minmax(0, 1fr) repeat(${labels.length}, 1.75rem)`,
        }}
      >
        <span
          className={cn(
            SECTION_HEADER_CLASS,
            "truncate tabular-nums whitespace-nowrap xl:hidden",
            liveLabel && "text-success",
          )}
        >
          {mobileHeader}
        </span>
        <span
          className={cn(
            SECTION_HEADER_CLASS,
            "hidden xl:inline",
            liveLabel && "text-success",
          )}
        >
          {matchupHeader}
        </span>
        {labels.map((label) => (
          <span
            key={label}
            className={cn(SECTION_HEADER_CLASS, "w-full text-center")}
          >
            {label}
          </span>
        ))}

        <TeamIdentity
          team={game.away}
          muted={game.away.winner === false}
          hasPossession={game.possession === "away"}
        />
        <ScoreCells
          team={game.away}
          labels={labels}
          muted={game.away.winner === false}
        />

        <TeamIdentity
          team={game.home}
          muted={game.home.winner === false}
          hasPossession={game.possession === "home"}
        />
        <ScoreCells
          team={game.home}
          labels={labels}
          muted={game.home.winner === false}
        />
      </div>

      <div className="hidden min-w-0 flex-col gap-1.5 xl:flex xl:w-28 xl:shrink-0">
        <span className={SECTION_HEADER_CLASS}>Status</span>
        <div className="flex flex-col gap-0.5 xl:flex-1 xl:justify-center">
          <p className="text-sm font-medium text-pretty">
            {formatKickoffDayShort(kickoff)}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {formatKickoffTime(kickoff)}
          </p>
        </div>
      </div>

      <div className="min-w-0 xl:flex xl:flex-col xl:gap-1.5">
        <span
          className={cn(
            SECTION_HEADER_CLASS,
            "truncate xl:hidden",
          )}
        >
          {game.venueLocation
            ? `${game.venue}, ${game.venueLocation}`
            : game.venue}
        </span>
        <span className={cn(SECTION_HEADER_CLASS, "hidden xl:inline")}>
          Location
        </span>
        <div className="hidden min-w-0 xl:flex xl:flex-1 xl:flex-col xl:justify-center">
          <p className="truncate text-sm font-medium">{game.venue}</p>
          {game.venueLocation ? (
            <p className="truncate text-xs text-muted-foreground">
              {game.venueLocation}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
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

  const sorted = games.toSorted(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
  );

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((game) => (
        <ScheduleGameCard
          key={game.id}
          game={game}
          week={week}
          seasonType={seasonType}
        />
      ))}
    </div>
  );
}
