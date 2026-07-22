"use client";

import { useState } from "react";

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
import { LeadersList } from "@/components/scores/game/leaders-list";
import {
  MISSING_VALUE,
  type GameDashboardData,
  type ScoringPlay,
  type WinProbabilityPoint,
} from "@/lib/espn/game-summary";
import { cn } from "@/lib/utils";

type LiveGameDashboardProps = {
  data: GameDashboardData;
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
      <CardHeader className="border-b bg-muted/40 py-3">
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

function groupPlaysByQuarter(plays: ScoringPlay[]) {
  const groups: { quarter: string; plays: ScoringPlay[] }[] = [];
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

function WinProbabilityChart({
  points,
  awayAbbrev,
  homeAbbrev,
}: {
  points: WinProbabilityPoint[];
  awayAbbrev: string;
  homeAbbrev: string;
}) {
  if (points.length === 0) {
    return <MissingBlock />;
  }

  const width = 280;
  const height = 120;
  const pad = 8;
  const coords = points.map((point, index) => {
    const x =
      pad + (index / Math.max(points.length - 1, 1)) * (width - pad * 2);
    const y = pad + ((100 - point.awayPct) / 100) * (height - pad * 2);
    return `${x},${y}`;
  });
  const line = coords.join(" ");
  const latest = points[points.length - 1]?.awayPct ?? 50;

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${awayAbbrev} win probability ${latest}%`}
      >
        <line
          x1={pad}
          x2={width - pad}
          y1={height / 2}
          y2={height / 2}
          className="stroke-border"
          strokeWidth={1}
        />
        <polyline
          fill="none"
          points={line}
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {awayAbbrev}{" "}
          <span className="font-medium tabular-nums text-foreground">
            {latest}%
          </span>
        </span>
        <span>
          {homeAbbrev}{" "}
          <span className="font-medium tabular-nums text-foreground">
            {(100 - latest).toFixed(0)}%
          </span>
        </span>
      </div>
    </div>
  );
}

export function LiveGameDashboard({ data }: LiveGameDashboardProps) {
  const { game } = data;
  const [playTab, setPlayTab] = useState("scoring");
  const plays =
    playTab === "scoring" ? data.scoringPlays : data.allPlays;
  const groups = plays ? groupPlaysByQuarter(plays) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,17rem)]">
      <div className="flex flex-col gap-4">
        <SectionCard title="Game leaders">
          {data.gameLeaders ? (
            <LeadersList leaders={data.gameLeaders} />
          ) : (
            <MissingBlock />
          )}
        </SectionCard>

        <SectionCard title="Team stats">
          {data.teamStats ? (
            <TableShell className="rounded-lg border-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead className="text-right">
                      {game.away.logoUrl ? (
                        <img
                          src={game.away.logoUrl}
                          alt={game.away.abbreviation}
                          width={20}
                          height={20}
                          className="ml-auto size-5"
                        />
                      ) : (
                        game.away.abbreviation
                      )}
                    </TableHead>
                    <TableHead className="text-right">
                      {game.home.logoUrl ? (
                        <img
                          src={game.home.logoUrl}
                          alt={game.home.abbreviation}
                          width={20}
                          height={20}
                          className="ml-auto size-5"
                        />
                      ) : (
                        game.home.abbreviation
                      )}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.teamStats.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.away}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.home}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          ) : (
            <MissingBlock />
          )}
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard title="Box score">
          {data.lineScore ? (
            <TableShell className="rounded-lg border-0">
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
                          <img
                            src={game.away.logoUrl}
                            alt=""
                            width={20}
                            height={20}
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
                          <img
                            src={game.home.logoUrl}
                            alt=""
                            width={20}
                            height={20}
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

        <SectionCard title="Play-by-play">
          <Tabs value={playTab} onValueChange={setPlayTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="scoring">Scoring plays</TabsTrigger>
              <TabsTrigger value="all">All plays</TabsTrigger>
            </TabsList>
          </Tabs>
          {groups == null ? (
            <MissingBlock />
          ) : groups.length === 0 ? (
            <MissingBlock />
          ) : (
            <ul className="flex flex-col gap-4">
              {groups.map((group) => (
                <li key={group.quarter} className="flex flex-col gap-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {group.quarter}
                  </p>
                  <ul className="flex flex-col gap-3">
                    {group.plays.map((play, index) => {
                      const logo =
                        play.teamAbbrev === game.away.abbreviation
                          ? game.away.logoUrl
                          : play.teamAbbrev === game.home.abbreviation
                            ? game.home.logoUrl
                            : "";

                      return (
                        <li
                          key={`${play.description}-${index}`}
                          className="flex items-start gap-3"
                        >
                          {logo ? (
                            <img
                              src={logo}
                              alt=""
                              width={20}
                              height={20}
                              className="mt-0.5 size-5 shrink-0"
                            />
                          ) : (
                            <span className="mt-0.5 size-5 shrink-0 text-xs text-muted-foreground">
                              {play.teamAbbrev}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-pretty">
                              {play.description}
                            </p>
                            <p className="text-xs tabular-nums text-muted-foreground">
                              {play.score}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard title="Win probability">
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

        <SectionCard title="Standings">
          {data.standings ? (
            <div className="flex flex-col gap-4">
              {data.standings.map((division) => (
                <div key={division.name} className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">{division.name}</p>
                  <TableShell className="rounded-lg border-0">
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
