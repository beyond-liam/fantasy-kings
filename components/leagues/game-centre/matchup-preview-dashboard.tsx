"use client";

import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { formatPoints, teamInitials } from "@/lib/leagues/standings";
import type { GameCentrePreview } from "@/lib/leagues/game-centre/preview";
import type { GameCentreTeamSide } from "@/lib/queries/game-centre";
import { cn } from "@/lib/utils";

type MatchupPreviewDashboardProps = {
  away: GameCentreTeamSide;
  home: GameCentreTeamSide;
  preview: GameCentrePreview;
  leagueSlug: string;
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

function MissingBlock({ label = "—" }: { label?: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}

function ColorSwatch({
  tone,
  className,
}: {
  tone: "muted" | "primary";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-3 shrink-0 rounded-xs",
        tone === "primary" ? "bg-primary" : "bg-muted",
        className,
      )}
    />
  );
}

function TeamMark({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  return (
    <Avatar size="sm" className="size-7">
      {logoUrl ? <AvatarImage src={logoUrl} alt="" /> : null}
      <AvatarFallback className="text-[10px]">
        {teamInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function MatchupPredictor({
  away,
  home,
}: {
  away: GameCentreTeamSide;
  home: GameCentreTeamSide;
}) {
  const awayPct =
    away.winChance != null ? Math.round(away.winChance * 1000) / 10 : null;
  const homePct =
    home.winChance != null ? Math.round(home.winChance * 1000) / 10 : null;
  const homeShare = homePct ?? 50;
  const projectedMargin =
    away.projectedPts != null && home.projectedPts != null
      ? Math.round((home.projectedPts - away.projectedPts) * 10) / 10
      : null;

  if (awayPct == null || homePct == null) {
    return <MissingBlock label="Win chance unavailable" />;
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div
        className="relative size-28 sm:size-32"
        role="img"
        aria-label={`${away.teamName} ${awayPct}%, ${home.teamName} ${homePct}%`}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(var(--primary) 0 ${homeShare}%, var(--muted) ${homeShare}% 100%)`,
            maskImage:
              "radial-gradient(farthest-side, transparent 72%, #000 73%)",
            WebkitMaskImage:
              "radial-gradient(farthest-side, transparent 72%, #000 73%)",
          }}
        />
        <div className="absolute inset-[22%] flex items-center justify-center gap-1.5">
          <TeamMark name={away.teamName} logoUrl={away.logoUrl} />
          <span
            aria-hidden
            className="h-7 w-px shrink-0 border-l border-dashed border-muted-foreground/40"
          />
          <TeamMark name={home.teamName} logoUrl={home.logoUrl} />
        </div>
      </div>

      <div className="flex w-full flex-col gap-1.5 text-sm font-medium">
        <span className="flex min-w-0 items-center gap-1.5">
          <ColorSwatch tone="muted" />
          <span className="truncate">{away.teamName}</span>
          <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
            {awayPct.toFixed(1)}%
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <ColorSwatch tone="primary" />
          <span className="truncate">{home.teamName}</span>
          <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
            {homePct.toFixed(1)}%
          </span>
        </span>
      </div>

      <div className="w-full border-t pt-3 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Projected</span>
          <span className="tabular-nums font-medium">
            {away.projectedPts == null || home.projectedPts == null
              ? "—"
              : `${formatPoints(away.projectedPts)}–${formatPoints(home.projectedPts)}`}
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span className="text-muted-foreground">Proj. margin</span>
          <span className="tabular-nums font-medium">
            {projectedMargin == null
              ? "—"
              : projectedMargin === 0
                ? "0.0"
                : `${projectedMargin > 0 ? "Home" : "Away"} ${Math.abs(projectedMargin).toFixed(1)}`}
          </span>
        </div>
      </div>
    </div>
  );
}

function LeaderSide({
  side,
  align,
}: {
  side: GameCentrePreview["leaders"][number]["away"];
  align: "left" | "right";
}) {
  const isEmpty = side.name === "—";
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      {!isEmpty ? (
        <PlayerAvatar
          fullName={side.name}
          sleeperId={side.sleeperId}
          primaryPositionId={side.primaryPositionId || "FLEX"}
          nflTeam={side.nflTeam}
          injuryStatus={side.injuryStatus}
          size="sm"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{side.name}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{side.line}</p>
      </div>
    </div>
  );
}

function InjuryDot({ tone }: { tone: "questionable" | "out" }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        tone === "questionable" ? "bg-warning" : "bg-destructive",
      )}
      aria-hidden
    />
  );
}

function formatMargin(margin: number) {
  if (Math.abs(margin) <= 0.05) return "0.0";
  const sign = margin > 0 ? "+" : "";
  return `${sign}${margin.toFixed(1)}`;
}

function HistoryStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums tracking-tight">{value}</p>
      {detail ? (
        <p className="text-xs text-pretty text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

function meetingDetail(
  meeting: {
    week: number;
    seasonYear: number;
    focusPts: number;
    opponentPts: number;
    margin: number;
  } | null,
  focusName: string,
) {
  if (!meeting) return undefined;
  return `W${meeting.week} ${meeting.seasonYear} · ${formatPoints(meeting.focusPts)}–${formatPoints(meeting.opponentPts)} (${formatMargin(meeting.margin)} ${focusName})`;
}

export function MatchupPreviewDashboard({
  away,
  home,
  preview,
  leagueSlug,
}: MatchupPreviewDashboardProps) {
  const { series, lastFive, leaders, injuries } = preview;
  const awayInjuries = injuries.filter((row) => row.side === "away");
  const homeInjuries = injuries.filter((row) => row.side === "home");

  const blowout = series.biggestBlowout;
  const closest = series.closestGame;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,17rem)]">
      <div className="flex flex-col gap-4">
        <SectionCard title="Matchup Predictor">
          <MatchupPredictor away={away} home={home} />
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard title="Season Leaders">
          {leaders.length === 0 ? (
            <Empty size="sm">
              <EmptyHeader>
                <EmptyTitle>No projections yet</EmptyTitle>
                <EmptyDescription>
                  Season projections appear once player data is available.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-4">
              {leaders.map((leader) => (
                <li
                  key={leader.category}
                  className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3"
                >
                  <LeaderSide side={leader.away} align="left" />
                  <p className="max-w-28 text-center text-[10px] font-medium leading-tight tracking-wide text-muted-foreground uppercase sm:max-w-32">
                    {leader.category}
                  </p>
                  <LeaderSide side={leader.home} align="right" />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Injury Report">
          {injuries.length === 0 ? (
            <Empty size="sm">
              <EmptyHeader>
                <EmptyTitle>No injuries listed</EmptyTitle>
                <EmptyDescription>
                  Starter injury updates appear closer to kickoff.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  [away.teamName, awayInjuries],
                  [home.teamName, homeInjuries],
                ] as const
              ).map(([teamName, rows]) => (
                <div key={teamName} className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">{teamName}</p>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">—</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {rows.map((row) => (
                        <li
                          key={`${row.side}-${row.playerName}-${row.status}`}
                          className="flex items-start justify-between gap-2 text-sm"
                        >
                          <span className="min-w-0">
                            <span className="font-medium">{row.playerName}</span>
                            {row.position ? (
                              <span className="text-muted-foreground">
                                {" "}
                                {row.position}
                              </span>
                            ) : null}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5 text-xs">
                            <InjuryDot tone={row.tone} />
                            <span>{row.statusLabel}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard title="Matchup History">
          {series.meetings.every((m) => m.result == null) ? (
            <Empty size="sm">
              <EmptyHeader>
                <EmptyTitle>No prior meetings</EmptyTitle>
                <EmptyDescription>
                  These teams have not met yet this season.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-4">
              <HistoryStat
                label="Series"
                value={series.recordLabel}
                detail={`${away.teamName} vs ${home.teamName}`}
              />
              <HistoryStat
                label="Avg margin"
                value={
                  series.avgMargin == null
                    ? "—"
                    : formatMargin(series.avgMargin)
                }
                detail="From away team’s perspective"
              />
              <HistoryStat
                label="Biggest blowout"
                value={
                  blowout?.margin == null
                    ? "—"
                    : formatMargin(Math.abs(blowout.margin))
                }
                detail={meetingDetail(
                  blowout &&
                    blowout.viewerPts != null &&
                    blowout.opponentPts != null &&
                    blowout.margin != null
                    ? {
                        week: blowout.week,
                        seasonYear: blowout.seasonYear,
                        focusPts: blowout.viewerPts,
                        opponentPts: blowout.opponentPts,
                        margin: blowout.margin,
                      }
                    : null,
                  away.teamName,
                )}
              />
              <HistoryStat
                label="Closest game"
                value={
                  closest?.margin == null
                    ? "—"
                    : formatMargin(Math.abs(closest.margin))
                }
                detail={meetingDetail(
                  closest &&
                    closest.viewerPts != null &&
                    closest.opponentPts != null &&
                    closest.margin != null
                    ? {
                        week: closest.week,
                        seasonYear: closest.seasonYear,
                        focusPts: closest.viewerPts,
                        opponentPts: closest.opponentPts,
                        margin: closest.margin,
                      }
                    : null,
                  away.teamName,
                )}
              />
              <HistoryStat label="Streak" value={series.streak ?? "—"} />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Last 5 Meetings">
          {lastFive.length === 0 ? (
            <Empty size="sm">
              <EmptyHeader>
                <EmptyTitle>No finalized meetings</EmptyTitle>
                <EmptyDescription>
                  Completed matchups will show here after scores land.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <TableShell className="rounded-lg border-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Wk</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastFive.map((row) => (
                    <TableRow key={`${row.seasonYear}-${row.week}-${row.publicId}`}>
                      <TableCell className="tabular-nums">
                        <Link
                          href={`/league/${leagueSlug}/scores/${row.publicId}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {row.week}
                        </Link>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-medium",
                          row.result === "W" && "text-success",
                          row.result === "L" && "text-destructive",
                        )}
                      >
                        {row.result}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPoints(row.focusPts)}–
                        {formatPoints(row.opponentPts)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
