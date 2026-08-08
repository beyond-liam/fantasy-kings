"use client";

import { useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameInformationCard } from "@/components/scores/game/game-information-card";
import { LeadersList } from "@/components/scores/game/leaders-list";
import { ScheduleTeamLogo } from "@/components/scores/schedule-team-logo";
import { TeamStatsComparison } from "@/components/scores/game/team-stats-comparison";
import { WinProbabilityChart } from "@/components/scores/game/win-probability-chart";
import {
  MISSING_VALUE,
  formatPlayQuarterLabel,
  type GameDashboardData,
  type ScoringPlay,
} from "@/lib/espn/game-summary";
import { cn } from "@/lib/utils";

type LiveGameDashboardProps = {
  data: GameDashboardData;
};

type QuarterGroup = {
  quarter: string;
  plays: ScoringPlay[];
};

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card size="sm" className={cn("gap-0 py-0", className)}>
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-4">{children}</CardContent>
    </Card>
  );
}

function MissingBlock() {
  return (
    <p className="text-sm tabular-nums text-muted-foreground">{MISSING_VALUE}</p>
  );
}

function groupPlaysByQuarter(plays: ScoringPlay[]): QuarterGroup[] {
  const groups: QuarterGroup[] = [];
  for (const play of plays) {
    const last = groups[groups.length - 1];
    if (last && last.quarter === play.quarter) {
      last.plays.push(play);
    } else {
      groups.push({ quarter: play.quarter, plays: [play] });
    }
  }
  return groups;
}

function withCurrentQuarterGroup(
  groups: QuarterGroup[],
  game: GameDashboardData["game"],
): QuarterGroup[] {
  if (game.status !== "in" || game.period == null) {
    return groups;
  }

  const current = formatPlayQuarterLabel(game.period);
  if (groups.some((group) => group.quarter === current)) {
    return groups;
  }

  return [...groups, { quarter: current, plays: [] }];
}

function defaultOpenQuarters(
  groups: QuarterGroup[],
  game: GameDashboardData["game"],
): string[] {
  if (groups.length === 0) return [];

  if (game.status === "in" && game.period != null) {
    const current = formatPlayQuarterLabel(game.period);
    if (groups.some((group) => group.quarter === current)) {
      return [current];
    }
  }

  const latest = groups.at(-1)?.quarter;
  return latest ? [latest] : [];
}

function PlayRow({
  play,
  awayAbbrev,
  awayLogoUrl,
  homeAbbrev,
  homeLogoUrl,
}: {
  play: ScoringPlay;
  awayAbbrev: string;
  awayLogoUrl: string;
  homeAbbrev: string;
  homeLogoUrl: string;
}) {
  const logo =
    play.teamAbbrev === awayAbbrev
      ? awayLogoUrl
      : play.teamAbbrev === homeAbbrev
        ? homeLogoUrl
        : "";

  return (
    <li className="flex items-start gap-3">
      {logo ? (
        <ScheduleTeamLogo
          src={logo}
          size={20}
          className="mt-0.5 size-5"
        />
      ) : (
        <span className="mt-0.5 size-5 shrink-0 text-xs text-muted-foreground">
          {play.teamAbbrev}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-pretty !mb-0">{play.description}</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {play.score}
        </p>
      </div>
    </li>
  );
}

export function LiveGameDashboard({ data }: LiveGameDashboardProps) {
  const { game } = data;
  const [playTab, setPlayTab] = useState("scoring");
  const plays =
    playTab === "scoring" ? data.scoringPlays : data.allPlays;
  const groups =
    plays == null
      ? null
      : withCurrentQuarterGroup(groupPlaysByQuarter(plays), game);
  const defaultOpen = groups ? defaultOpenQuarters(groups, game) : [];
  const accordionKey = `${playTab}:${game.status}:${game.period ?? "none"}`;

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,17rem)]">
      {/* Mobile order via `contents` + order-*; desktop restores column stacks. */}
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
        <SectionCard title="Team Stats" className="order-1 lg:order-0">
          {data.teamStats ? (
            <TeamStatsComparison
              rows={data.teamStats}
              awayAbbrev={game.away.abbreviation}
              homeAbbrev={game.home.abbreviation}
            />
          ) : (
            <MissingBlock />
          )}
        </SectionCard>
        <GameInformationCard
          className="order-7 lg:order-0"
          game={game}
          attendance={data.attendance}
          officials={data.officials}
        />
      </div>

      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
        <SectionCard title="Box Score" className="order-2 lg:order-0">
          {data.lineScore ? (
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    {data.lineScore.periods.map((period) => (
                      <TableHead key={period} className="text-right">
                        {period}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {game.away.logoUrl ? (
                          <ScheduleTeamLogo
                            src={game.away.logoUrl}
                            size={20}
                            className="size-5"
                          />
                        ) : null}
                        {game.away.abbreviation}
                      </span>
                    </TableCell>
                    {data.lineScore.away.map((value, index) => (
                      <TableCell
                        key={`away-${index}`}
                        className={cn(
                          "text-right tabular-nums",
                          index === data.lineScore!.away.length - 1 &&
                            "font-semibold",
                        )}
                      >
                        {value}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {game.home.logoUrl ? (
                          <ScheduleTeamLogo
                            src={game.home.logoUrl}
                            size={20}
                            className="size-5"
                          />
                        ) : null}
                        {game.home.abbreviation}
                      </span>
                    </TableCell>
                    {data.lineScore.home.map((value, index) => (
                      <TableCell
                        key={`home-${index}`}
                        className={cn(
                          "text-right tabular-nums",
                          index === data.lineScore!.home.length - 1 &&
                            "font-semibold",
                        )}
                      >
                        {value}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </TableShell>
          ) : (
            <MissingBlock />
          )}
        </SectionCard>

        <SectionCard title="Play By Play" className="order-3 lg:order-0">
          <Tabs value={playTab} onValueChange={setPlayTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="scoring">Scoring Plays</TabsTrigger>
              <TabsTrigger value="all">All Plays</TabsTrigger>
            </TabsList>
          </Tabs>
          {groups == null || groups.length === 0 ? (
            <MissingBlock />
          ) : (
            <Accordion
              key={accordionKey}
              multiple
              defaultValue={defaultOpen}
              className="w-full"
            >
              {groups.map((group) => (
                <AccordionItem key={group.quarter} value={group.quarter}>
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="text-sm font-medium">{group.quarter}</span>
                      <span className="text-xs font-normal tabular-nums text-muted-foreground">
                        {group.plays.length}{" "}
                        {group.plays.length === 1 ? "play" : "plays"}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="[&_p]:mb-0">
                    {group.plays.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No plays yet
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-3">
                        {group.plays.map((play, index) => (
                          <PlayRow
                            key={`${play.description}-${index}`}
                            play={play}
                            awayAbbrev={game.away.abbreviation}
                            awayLogoUrl={game.away.logoUrl}
                            homeAbbrev={game.home.abbreviation}
                            homeLogoUrl={game.home.logoUrl}
                          />
                        ))}
                      </ul>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </SectionCard>

        <SectionCard title="Game Leaders" className="order-4 lg:order-0">
          {data.gameLeaders ? (
            <LeadersList leaders={data.gameLeaders} />
          ) : (
            <MissingBlock />
          )}
        </SectionCard>
      </div>

      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
        <SectionCard title="Win Probability" className="order-5 lg:order-0">
          {data.winProbability ? (
            <WinProbabilityChart
              points={data.winProbability}
              awayAbbrev={game.away.abbreviation}
              homeAbbrev={game.home.abbreviation}
            />
          ) : (
            <MissingBlock />
          )}
        </SectionCard>

        <SectionCard title="Standings" className="order-6 lg:order-0">
          {data.standings ? (
            <div className="flex flex-col gap-4">
              {data.standings.map((division) => (
                <div key={division.name} className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">{division.name}</p>
                  <TableShell>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team</TableHead>
                          <TableHead className="text-right">W</TableHead>
                          <TableHead className="text-right">L</TableHead>
                          <TableHead className="text-right">W%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {division.rows.map((row) => (
                          <TableRow
                            key={row.abbrev}
                            className={cn(row.highlight && "bg-muted/50")}
                          >
                            <TableCell className="font-medium">
                              {row.abbrev}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.w}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.l}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.pct}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableShell>
                </div>
              ))}
            </div>
          ) : (
            <MissingBlock />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
