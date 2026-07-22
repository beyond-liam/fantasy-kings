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
import { LeadersList } from "@/components/scores/game/leaders-list";
import {
  MISSING_VALUE,
  type GameDashboardData,
} from "@/lib/espn/game-summary";
import { getInjuryIndicator } from "@/lib/players/injury";
import { formatKickoffDay, formatKickoffTime } from "@/lib/nfl/schedule-week";
import { cn } from "@/lib/utils";

type PreGameDashboardProps = {
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

function MatchupPredictor({
  awayAbbrev,
  homeAbbrev,
  awayPct,
  homePct,
}: {
  awayAbbrev: string;
  homeAbbrev: string;
  awayPct: number;
  homePct: number;
}) {
  const gradient = `conic-gradient(var(--primary) 0 ${homePct}%, var(--muted) ${homePct}% 100%)`;

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div
        className="relative size-36 rounded-full"
        style={{ background: gradient }}
        role="img"
        aria-label={`${awayAbbrev} ${awayPct}%, ${homeAbbrev} ${homePct}%`}
      >
        <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-card text-center">
          <p className="text-xs text-muted-foreground">Win %</p>
          <p className="text-sm font-semibold tabular-nums">
            {awayPct.toFixed(1)} / {homePct.toFixed(1)}
          </p>
        </div>
      </div>
      <div className="flex w-full justify-between gap-2 text-sm font-medium">
        <span>
          {awayAbbrev}{" "}
          <span className="tabular-nums text-muted-foreground">
            {awayPct.toFixed(1)}%
          </span>
        </span>
        <span>
          {homeAbbrev}{" "}
          <span className="tabular-nums text-muted-foreground">
            {homePct.toFixed(1)}%
          </span>
        </span>
      </div>
    </div>
  );
}

function InjuryDot({ status }: { status: string }) {
  const injury = getInjuryIndicator(status);
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        injury?.tone === "questionable" && "bg-orange-500",
        (!injury || injury.tone === "out") && "bg-rose-500",
      )}
      aria-hidden
    />
  );
}

export function PreGameDashboard({ data }: PreGameDashboardProps) {
  const { game } = data;
  const kickoff = new Date(game.kickoff);
  const venueLabel = game.venueLocation
    ? `${game.venue}, ${game.venueLocation}`
    : game.venue;

  const awayInjuries =
    data.injuries?.filter((row) => row.side === "away") ?? null;
  const homeInjuries =
    data.injuries?.filter((row) => row.side === "home") ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,17rem)]">
      <div className="flex flex-col gap-4">
        <SectionCard title="Matchup predictor">
          {data.predictor ? (
            <MatchupPredictor
              awayAbbrev={game.away.abbreviation}
              homeAbbrev={game.home.abbreviation}
              awayPct={data.predictor.awayPct}
              homePct={data.predictor.homePct}
            />
          ) : (
            <MissingBlock />
          )}
        </SectionCard>

        <SectionCard title="Game information">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium tabular-nums">
                {formatKickoffTime(kickoff)}, {formatKickoffDay(kickoff)}
              </p>
              <p className="text-sm text-muted-foreground">{venueLabel}</p>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Where to watch
              </p>
              <p className="mt-1 text-sm font-medium">
                {game.network ?? MISSING_VALUE}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard title="Game odds">
          {data.odds ? (
            <>
              <TableShell className="rounded-lg border-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>Open</TableHead>
                      <TableHead>Spread</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>ML</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">
                        {game.away.abbreviation}{" "}
                        <span className="text-muted-foreground">
                          {game.away.record}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {data.odds.away.open}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {data.odds.away.spread}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {data.odds.away.total}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {data.odds.away.moneyline}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">
                        {game.home.abbreviation}{" "}
                        <span className="text-muted-foreground">
                          {game.home.record}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {data.odds.home.open}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {data.odds.home.spread}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {data.odds.home.total}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {data.odds.home.moneyline}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableShell>
              {data.odds.provider ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Odds by {data.odds.provider}
                </p>
              ) : null}
            </>
          ) : (
            <MissingBlock />
          )}
        </SectionCard>

        <SectionCard title="Season leaders">
          {data.seasonLeaders ? (
            <LeadersList leaders={data.seasonLeaders} />
          ) : (
            <MissingBlock />
          )}
        </SectionCard>

        <SectionCard title="Injury report">
          {data.injuries ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  [game.away.nickname, awayInjuries ?? []],
                  [game.home.nickname, homeInjuries ?? []],
                ] as const
              ).map(([label, rows]) => (
                <div key={label} className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {MISSING_VALUE}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {rows.map((row) => (
                        <li
                          key={`${row.name}-${row.status}-${row.estReturn}`}
                          className="flex items-start justify-between gap-2 text-sm"
                        >
                          <span className="min-w-0">
                            <span className="font-medium">{row.name}</span>
                            {row.position ? (
                              <span className="text-muted-foreground">
                                {" "}
                                {row.position}
                              </span>
                            ) : null}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5 text-xs">
                            <InjuryDot status={row.status} />
                            <span>{row.status}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {row.estReturn}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <MissingBlock />
          )}
        </SectionCard>

        <SectionCard title="Last five games">
          {data.awayForm != null && data.homeForm != null ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  [game.away.abbreviation, data.awayForm],
                  [game.home.abbreviation, data.homeForm],
                ] as const
              ).map(([label, rows]) => (
                <div key={label} className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {MISSING_VALUE}
                    </p>
                  ) : (
                    <TableShell className="rounded-lg border-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Opp</TableHead>
                            <TableHead>Result</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow
                              key={`${label}-${row.date}-${row.opponentAbbrev}-${row.score}`}
                            >
                              <TableCell className="tabular-nums">
                                {row.date}
                              </TableCell>
                              <TableCell>{row.opponentAbbrev}</TableCell>
                              <TableCell
                                className={cn(
                                  "tabular-nums",
                                  row.result === "W" && "text-chart-2",
                                  row.result === "L" && "text-destructive",
                                )}
                              >
                                {row.result} {row.score}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableShell>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <MissingBlock />
          )}
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4">
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
                          <TableHead className="text-right">T</TableHead>
                          <TableHead className="text-right">W%</TableHead>
                          <TableHead className="text-right">PF</TableHead>
                          <TableHead className="text-right">PA</TableHead>
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
                              {row.t}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.pct}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.pf}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.pa}
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
