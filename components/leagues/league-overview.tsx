import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { ManagerPresenceBadge } from "@/components/leagues/presence/manager-presence-badge";
import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { PlayerProfileTrigger } from "@/components/rankings/player-identity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  OverviewInefficiencyRow,
  OverviewPositionLeader,
  OverviewTeamMetric,
  OverviewWeeklyRoast,
} from "@/lib/leagues/league-overview";
import {
  formatPoints,
  formatRecord,
  formatWinPct,
  teamInitials,
  type LeagueStandingsRow,
  type StandingsFormGame,
} from "@/lib/leagues/standings";
import type { OverviewPlayerHighlight } from "@/lib/leagues/overview-players-of-the-week";
import { cn } from "@/lib/utils";

export type LeagueOverviewProps = {
  leagueSlug: string;
  standingsRows: LeagueStandingsRow[];
  myTeamId: string | null;
  highestScorer: OverviewTeamMetric | null;
  worstDefense: OverviewTeamMetric | null;
  inefficient: OverviewInefficiencyRow | null;
  seasonLeaders: OverviewPositionLeader[];
  playersOfTheWeek: {
    passer: OverviewPlayerHighlight | null;
    rusher: OverviewPlayerHighlight | null;
    receiver: OverviewPlayerHighlight | null;
  };
  playersOfTheSeason: {
    passer: OverviewPlayerHighlight | null;
    rusher: OverviewPlayerHighlight | null;
    receiver: OverviewPlayerHighlight | null;
  };
  highlightWeek: number | null;
  /** Latest scored week roast; null before any finalized week. */
  weeklyRoast: OverviewWeeklyRoast | null;
};

function OverviewCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card size="sm" className="gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">{title}</CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="py-4">{children}</CardContent>
    </Card>
  );
}

function TeamMark({
  name,
  logoUrl,
  ownerUserId,
  size = "sm",
}: {
  name: string;
  logoUrl: string | null;
  ownerUserId?: string | null;
  size?: "sm" | "lg" | "hero";
}) {
  return (
    <Avatar
      size={size === "sm" ? "sm" : "lg"}
      className={cn(size === "hero" && "size-16 text-base")}
    >
      {logoUrl ? <AvatarImage src={logoUrl} alt="" /> : null}
      <AvatarFallback className={cn(size === "hero" && "text-sm")}>
        {teamInitials(name)}
      </AvatarFallback>
      <ManagerPresenceBadge userId={ownerUserId} />
    </Avatar>
  );
}

function FormGuide({
  games,
  compact = false,
}: {
  games: StandingsFormGame[];
  compact?: boolean;
}) {
  if (games.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <TooltipProvider>
      <div
        className={cn("flex items-center", compact ? "gap-0.5" : "gap-1")}
        aria-label="Last five results"
      >
        {games.map((game, index) => (
          <Tooltip key={`${game.week}-${game.opponentName}-${index}`}>
            <TooltipTrigger
              render={
                <span
                  className={cn(
                    "inline-flex shrink-0 cursor-pointer",
                    compact ? "size-2 rounded-xs" : "size-4 rounded-sm",
                    game.result === "W" && "bg-success",
                    game.result === "L" && "bg-destructive",
                    game.result === "T" && "bg-slate-600",
                  )}
                  aria-label={`${game.result} vs ${game.opponentName}`}
                />
              }
            />
            <TooltipContent>
              Week {game.week}: {game.result} vs {game.opponentName} (
              {formatPoints(game.ownPts)}–{formatPoints(game.oppPts)})
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

function TeamSpotlight({
  row,
  leagueSlug,
  emptyTitle = "No data yet",
  empty,
  formatValue,
  valueClassName,
  valueHint,
}: {
  row: OverviewTeamMetric | null;
  leagueSlug: string;
  emptyTitle?: string;
  empty: string;
  formatValue: (value: number) => string;
  valueClassName?: string;
  valueHint?: string;
}) {
  if (!row) {
    return (
      <Empty size="sm">
        <EmptyHeader>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{empty}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const href = row.teamPublicId
    ? `/league/${leagueSlug}/team/${row.teamPublicId}`
    : `/league/${leagueSlug}`;

  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 py-2 text-center outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <TeamMark
        name={row.teamName}
        logoUrl={row.logoUrl}
        ownerUserId={row.ownerUserId}
        size="hero"
      />
      <div className="min-w-0 max-w-full">
        <p className="truncate text-sm font-medium text-balance">
          {row.teamName}
        </p>
        <p className="truncate text-xs text-muted-foreground">{row.ownerName}</p>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            valueClassName,
          )}
        >
          {formatValue(row.value)}
        </p>
        {valueHint ? (
          <p className="text-xs text-muted-foreground">{valueHint}</p>
        ) : null}
      </div>
    </Link>
  );
}

function PlayerSpotlight({
  player,
  leagueSlug,
  emptyTitle = "No data yet",
  empty,
}: {
  player: OverviewPlayerHighlight | null;
  leagueSlug: string;
  emptyTitle?: string;
  empty: string;
}) {
  if (!player) {
    return (
      <Empty size="sm">
        <EmptyHeader>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{empty}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
      <PlayerProfileTrigger
        playerId={player.id}
        leagueSlug={leagueSlug}
        aria-label={`View ${player.fullName}`}
        className="flex flex-col items-center gap-2"
      >
        <PlayerAvatar
          fullName={player.fullName}
          sleeperId={player.sleeperId}
          primaryPositionId={player.primaryPositionId}
          nflTeam={player.nflTeam}
          size="lg"
          className="!size-24"
        />
        <div className="min-w-0 max-w-full text-center">
          <p className="truncate text-sm font-medium text-balance underline-offset-2 group-hover/player-identity:underline group-focus-visible/player-identity:underline">
            {player.fullName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[player.nflTeam, player.primaryPositionId]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </PlayerProfileTrigger>
      <div className="flex flex-col items-center gap-0.5">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {formatPoints(player.points)}
        </p>
        <p className="text-xs text-muted-foreground">fantasy pts</p>
      </div>
    </div>
  );
}

function OverviewStandingsCard({
  leagueSlug,
  standingsRows,
  myTeamId,
}: {
  leagueSlug: string;
  standingsRows: LeagueStandingsRow[];
  myTeamId: string | null;
}) {
  return (
    <OverviewCard
      title="Standings"
      action={
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          render={<Link href={`/league/${leagueSlug}?tab=standings`} />}
        >
          Full standings
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            data-icon="inline-end"
          />
        </Button>
      }
    >
      {standingsRows.length === 0 ? (
        <Empty size="sm">
          <EmptyHeader>
            <EmptyTitle>No standings yet</EmptyTitle>
            <EmptyDescription>
              Standings appear after teams are claimed.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ul className="flex flex-col overflow-hidden rounded-lg border md:hidden">
            {standingsRows.map((row) => {
              const isMine = Boolean(myTeamId && row.teamId === myTeamId);
              return (
                <li
                  key={row.id}
                  className={cn(
                    "flex items-center gap-2 border-b border-border px-2 py-2 last:border-b-0",
                    isMine && "bg-muted/50",
                  )}
                >
                  <span className="w-5 shrink-0 text-center text-sm tabular-nums text-muted-foreground">
                    {row.rank ?? "—"}
                  </span>
                  <TeamMark name={row.teamName} logoUrl={row.logoUrl} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link
                      href={
                        row.teamPublicId
                          ? `/league/${leagueSlug}/team/${row.teamPublicId}`
                          : `/league/${leagueSlug}`
                      }
                      className="truncate text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {row.teamName}
                    </Link>
                    <FormGuide games={row.form} compact />
                  </div>
                  <span className="shrink-0 text-sm tabular-nums">
                    {formatRecord(row.wins, row.losses, row.ties)}
                  </span>
                </li>
              );
            })}
          </ul>

          <TableShell className="max-md:hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8 px-2" aria-label="Position" />
                  <TableHead>Team</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Form</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standingsRows.map((row) => {
                  const isMine = Boolean(myTeamId && row.teamId === myTeamId);
                  return (
                    <TableRow
                      key={row.id}
                      className={cn(isMine && "bg-muted/50")}
                    >
                      <TableCell className="w-8 px-2 tabular-nums text-muted-foreground">
                        {row.rank ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamMark name={row.teamName} logoUrl={row.logoUrl} />
                          <Link
                            href={
                              row.teamPublicId
                                ? `/league/${leagueSlug}/team/${row.teamPublicId}`
                                : `/league/${leagueSlug}`
                            }
                            className="truncate font-medium underline-offset-2 hover:underline"
                          >
                            {row.teamName}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatRecord(row.wins, row.losses, row.ties)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatWinPct(row.winPct)}
                      </TableCell>
                      <TableCell>
                        <FormGuide games={row.form} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableShell>
        </>
      )}
    </OverviewCard>
  );
}

function PlayerLeaderRow({
  leagueSlug,
  passer,
  rusher,
  receiver,
  emptyScope,
}: {
  leagueSlug: string;
  passer: OverviewPlayerHighlight | null;
  rusher: OverviewPlayerHighlight | null;
  receiver: OverviewPlayerHighlight | null;
  emptyScope: "week" | "season";
}) {
  const after =
    emptyScope === "week"
      ? "after weekly scores land."
      : "after scores land.";
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <OverviewCard title="Passing Leader">
        <PlayerSpotlight
          player={passer}
          leagueSlug={leagueSlug}
          emptyTitle="No QB scores yet"
          empty={`Top passers appear ${after}`}
        />
      </OverviewCard>
      <OverviewCard title="Rushing Leader">
        <PlayerSpotlight
          player={rusher}
          leagueSlug={leagueSlug}
          emptyTitle="No RB scores yet"
          empty={`Top rushers appear ${after}`}
        />
      </OverviewCard>
      <OverviewCard title="Receiving Leader">
        <PlayerSpotlight
          player={receiver}
          leagueSlug={leagueSlug}
          emptyTitle="No WR/TE scores yet"
          empty={`Top receivers appear ${after}`}
        />
      </OverviewCard>
    </div>
  );
}

export function LeagueOverview({
  leagueSlug,
  standingsRows,
  myTeamId,
  highestScorer,
  worstDefense,
  inefficient,
  seasonLeaders,
  playersOfTheWeek,
  playersOfTheSeason,
  highlightWeek,
  weeklyRoast,
}: LeagueOverviewProps) {
  const thisWeekNumber = highlightWeek ?? weeklyRoast?.week ?? null;
  const showThisWeek = thisWeekNumber != null;

  return (
    <div className="flex flex-col gap-4">
      {showThisWeek ? (
        <>
          <h2 className="text-lg font-semibold tracking-tight">
            This Week
            <span className="text-muted-foreground">
              {" "}
              · W{thisWeekNumber}
            </span>
          </h2>
          {weeklyRoast ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <OverviewCard title="Top Scorer">
                <TeamSpotlight
                  row={weeklyRoast.biggestScorer}
                  leagueSlug={leagueSlug}
                  emptyTitle="No scores yet"
                  empty="Scores appear after this week's games finish."
                  formatValue={(value) => formatPoints(value)}
                  valueHint="points for"
                />
              </OverviewCard>
              <OverviewCard title="Luckiest Winner">
                <TeamSpotlight
                  row={weeklyRoast.luckiestWinner}
                  leagueSlug={leagueSlug}
                  emptyTitle="No winners yet"
                  empty="Winners appear after this week's scores land."
                  formatValue={(value) => formatPoints(value)}
                  valueHint="winning score"
                />
              </OverviewCard>
              <OverviewCard title="Underachiever">
                <TeamSpotlight
                  row={weeklyRoast.underachiever}
                  leagueSlug={leagueSlug}
                  emptyTitle="No underachievers yet"
                  empty="Bench bombs appear among losing teams after scores land."
                  formatValue={(value) => formatPoints(value)}
                  valueClassName="text-destructive"
                  valueHint="left on bench"
                />
              </OverviewCard>
            </div>
          ) : null}
          <PlayerLeaderRow
            leagueSlug={leagueSlug}
            passer={playersOfTheWeek.passer}
            rusher={playersOfTheWeek.rusher}
            receiver={playersOfTheWeek.receiver}
            emptyScope="week"
          />
          <h2 className="mt-6 text-lg font-semibold tracking-tight">
            Season Overview
          </h2>
        </>
      ) : (
        <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
      )}
      <div className="lg:hidden">
        <OverviewStandingsCard
          leagueSlug={leagueSlug}
          standingsRows={standingsRows}
          myTeamId={myTeamId}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <OverviewCard title="Top Scorer">
          <TeamSpotlight
            row={highestScorer}
            leagueSlug={leagueSlug}
            emptyTitle="No scores yet"
            empty="Scores show after weekly scores land."
            formatValue={(value) => formatPoints(value)}
            valueHint="points for"
          />
        </OverviewCard>
        <OverviewCard title="Worst Defense">
          <TeamSpotlight
            row={worstDefense}
            leagueSlug={leagueSlug}
            emptyTitle="No scores yet"
            empty="Scores show after weekly scores land."
            formatValue={(value) => formatPoints(value)}
            valueHint="points against"
          />
        </OverviewCard>
        <OverviewCard title="Most Inefficient">
          <TeamSpotlight
            row={inefficient}
            leagueSlug={leagueSlug}
            emptyTitle="No gaps yet"
            empty="Efficiency gaps show after weekly scores land."
            formatValue={(value) => `${value}%`}
            valueClassName="text-destructive"
            valueHint="of optimal"
          />
        </OverviewCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="max-lg:hidden">
          <OverviewStandingsCard
            leagueSlug={leagueSlug}
            standingsRows={standingsRows}
            myTeamId={myTeamId}
          />
        </div>

        <OverviewCard
          title="Season Leaders"
          action={
            <Button
              nativeButton={false}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              render={<Link href={`/league/${leagueSlug}?tab=stats`} />}
            >
              View league stats
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                data-icon="inline-end"
              />
            </Button>
          }
        >
          {seasonLeaders.length === 0 ? (
            <Empty size="sm">
              <EmptyHeader>
                <EmptyTitle>No leaders yet</EmptyTitle>
                <EmptyDescription>
                  Position leaders show after weekly scores land.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {seasonLeaders.map((leader) => (
                <li
                  key={leader.positionId}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium leading-tight tracking-wide text-muted-foreground uppercase">
                      {leader.label}
                    </p>
                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <TeamMark
                        name={leader.teamName}
                        logoUrl={leader.logoUrl}
                      />
                      <Link
                        href={
                          leader.teamPublicId
                            ? `/league/${leagueSlug}/team/${leader.teamPublicId}`
                            : `/league/${leagueSlug}`
                        }
                        className="truncate font-medium underline-offset-2 hover:underline"
                      >
                        {leader.teamName}
                      </Link>
                    </div>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium">
                    {formatPoints(leader.points)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </OverviewCard>
      </div>

      <PlayerLeaderRow
        leagueSlug={leagueSlug}
        passer={playersOfTheSeason.passer}
        rusher={playersOfTheSeason.rusher}
        receiver={playersOfTheSeason.receiver}
        emptyScope="season"
      />
    </div>
  );
}
