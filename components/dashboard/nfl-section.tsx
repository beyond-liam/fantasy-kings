import { HugeiconsIcon } from "@hugeicons/react";
import {
  TradeDownIcon as TrendingDownIcon,
  TradeUpIcon as TrendingUpIcon,
} from "@hugeicons/core-free-icons";

import { PlayerAvatar } from "@/components/rankings/player-avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
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
import type { DashboardNflPlayer } from "@/lib/leagues/dashboard-nfl";
import { formatRosterRatePct } from "@/lib/leagues/format-roster-rate";
import type { DashboardNflData } from "@/lib/queries/dashboard-nfl";
import { cn } from "@/lib/utils";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card size="sm" className="gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">{title}</CardTitle>
        {description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="py-4">{children}</CardContent>
    </Card>
  );
}

function PlayerSpotlight({
  player,
  emptyTitle,
  empty,
  trend,
}: {
  player: DashboardNflPlayer | null;
  emptyTitle: string;
  empty: string;
  trend?: "up" | "down";
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

  const trendUp = trend === "up";
  const metric = (
    <p
      className={cn(
        "inline-flex items-center gap-1 text-2xl font-semibold leading-none tracking-tight tabular-nums",
        trend === "up" && "text-success",
        trend === "down" && "text-destructive",
      )}
    >
      {trend ? (
        <HugeiconsIcon
          icon={trendUp ? TrendingUpIcon : TrendingDownIcon}
          strokeWidth={2}
        />
      ) : null}
      {trend ? player.value : player.line}
    </p>
  );

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <div className="flex flex-col items-center gap-2">
        <PlayerAvatar
          fullName={player.fullName}
          sleeperId={player.sleeperId}
          primaryPositionId={player.primaryPositionId}
          nflTeam={player.nflTeam}
          size="lg"
          className="size-20! [&_[data-slot=avatar-fallback]]:text-2xl!"
        />
        <div className="min-w-0 max-w-full text-center">
          <p className="truncate text-sm font-semibold text-balance">
            {player.fullName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[player.nflTeam, player.primaryPositionId]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center">
        {metric}
        {trend ? (
          <p className="mt-1 text-xs leading-none text-muted-foreground">
            {formatRosterRatePct(player.ownedPct)} owned
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TeamOfTheWeek({ data }: { data: DashboardNflData }) {
  const hasPlayers = data.totw.some((row) => row.player);

  return (
    <SectionCard
      title="Team of the Week"
      description={data.totwWeek != null ? `Week ${data.totwWeek}` : undefined}
    >
      {!hasPlayers ? (
        <Empty size="sm">
          <EmptyHeader>
            <EmptyTitle>No scores yet</EmptyTitle>
            <EmptyDescription>
              A standard lineup appears after games finish for the week.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16">Slot</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.totw.map((row, index) => (
                <TableRow key={`${row.slot}-${index}`}>
                  <TableCell className="text-muted-foreground">
                    {row.slot}
                  </TableCell>
                  <TableCell>
                    {row.player ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <PlayerAvatar
                          fullName={row.player.fullName}
                          sleeperId={row.player.sleeperId}
                          primaryPositionId={row.player.primaryPositionId}
                          nflTeam={row.player.nflTeam}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {row.player.fullName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[row.player.nflTeam, row.player.primaryPositionId]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.player ? row.player.value.toFixed(1) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      )}
    </SectionCard>
  );
}

export function NflDashboardSection({ data }: { data: DashboardNflData }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight text-balance">
        NFL
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <SectionCard title="Passing Leader">
          <PlayerSpotlight
            player={data.passing}
            emptyTitle="No passers yet"
            empty="Season leaders appear after games are scored."
          />
        </SectionCard>
        <SectionCard title="Rushing Leader">
          <PlayerSpotlight
            player={data.rushing}
            emptyTitle="No rushers yet"
            empty="Season leaders appear after games are scored."
          />
        </SectionCard>
        <SectionCard title="Receiving Leader">
          <PlayerSpotlight
            player={data.receiving}
            emptyTitle="No receivers yet"
            empty="Season leaders appear after games are scored."
          />
        </SectionCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TeamOfTheWeek data={data} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <SectionCard title="Trending Up">
            <PlayerSpotlight
              player={data.trendingUp}
              trend="up"
              emptyTitle="No adds yet"
              empty="Most claimed players appear after adds and waiver awards."
            />
          </SectionCard>
          <SectionCard title="Trending Down">
            <PlayerSpotlight
              player={data.trendingDown}
              trend="down"
              emptyTitle="No cuts yet"
              empty="Most cut players appear after drops."
            />
          </SectionCard>
        </div>
      </div>
    </section>
  );
}
