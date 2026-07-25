import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { TvMinimal as TvMinimalIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
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
import { formatPoints } from "@/lib/leagues/standings";
import type { TeamH2hSeries } from "@/lib/leagues/team-h2h";
import { cn } from "@/lib/utils";

type TeamH2hSectionProps = {
  series: TeamH2hSeries;
  leagueSlug: string;
  viewerTeamName: string;
  opponentTeamName: string;
};

function resultClassName(result: "W" | "L" | "T" | null) {
  if (result === "W") return "text-success";
  if (result === "L") return "text-destructive";
  return "text-muted-foreground";
}

function resultLabel(result: "W" | "L" | "T" | null) {
  if (result === "W") return "Win";
  if (result === "L") return "Loss";
  if (result === "T") return "Tie";
  return "—";
}

function formatMargin(margin: number | null) {
  if (margin == null) return "—";
  if (Math.abs(margin) <= 0.05) return "0.0";
  const sign = margin > 0 ? "+" : "";
  return `${sign}${margin.toFixed(1)}`;
}

function longestStreakHint(
  longestWinStreak: number,
  longestLossStreak: number,
) {
  if (longestWinStreak === 0 && longestLossStreak === 0) return null;
  const parts: string[] = [];
  if (longestWinStreak > 0) parts.push(`W${longestWinStreak}`);
  if (longestLossStreak > 0) parts.push(`L${longestLossStreak}`);
  return `Longest ${parts.join(" · ")}`;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? (
        <p className="text-xs tabular-nums text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function TeamH2hSection({
  series,
  leagueSlug,
  viewerTeamName,
  opponentTeamName,
}: TeamH2hSectionProps) {
  if (series.meetings.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No meetings yet</EmptyTitle>
          <EmptyDescription>
            {viewerTeamName} and {opponentTeamName} have not been scheduled
            against each other this season.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Series" value={series.recordLabel} />
        <Stat
          label="Avg PF"
          value={
            series.avgPf == null ? "—" : formatPoints(series.avgPf)
          }
        />
        <Stat
          label="Avg margin"
          value={
            series.avgMargin == null ? "—" : formatMargin(series.avgMargin)
          }
        />
        <Stat
          label="Streak"
          value={series.streak ?? "—"}
          hint={longestStreakHint(
            series.longestWinStreak,
            series.longestLossStreak,
          )}
        />
      </div>

      {(series.bestWin || series.worstLoss) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {series.bestWin ? (
            <div className="rounded-lg border border-border px-4 py-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Best win
              </p>
              <p className="mt-1 text-sm text-pretty">
                Week {series.bestWin.week} ·{" "}
                <span className="tabular-nums font-medium text-success">
                  {formatPoints(series.bestWin.viewerPts ?? 0)}–
                  {formatPoints(series.bestWin.opponentPts ?? 0)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  ({formatMargin(series.bestWin.margin)})
                </span>
              </p>
            </div>
          ) : null}
          {series.worstLoss ? (
            <div className="rounded-lg border border-border px-4 py-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Worst loss
              </p>
              <p className="mt-1 text-sm text-pretty">
                Week {series.worstLoss.week} ·{" "}
                <span className="tabular-nums font-medium text-destructive">
                  {formatPoints(series.worstLoss.viewerPts ?? 0)}–
                  {formatPoints(series.worstLoss.opponentPts ?? 0)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  ({formatMargin(series.worstLoss.margin)})
                </span>
              </p>
            </div>
          ) : null}
        </div>
      )}

      <TableShell>
        <Table className="min-w-[36rem]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Season</TableHead>
              <TableHead>Week</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Margin</TableHead>
              <TableHead>
                <span className="sr-only">Matchup</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {series.meetings.map((meeting) => (
              <TableRow key={meeting.id}>
                <TableCell className="tabular-nums">
                  {meeting.seasonYear}
                </TableCell>
                <TableCell className="tabular-nums">{meeting.week}</TableCell>
                <TableCell className="tabular-nums">
                  {meeting.viewerPts != null && meeting.opponentPts != null
                    ? `${formatPoints(meeting.viewerPts)}–${formatPoints(meeting.opponentPts)}`
                    : "—"}
                </TableCell>
                <TableCell
                  className={cn("font-medium", resultClassName(meeting.result))}
                >
                  {resultLabel(meeting.result)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatMargin(meeting.margin)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    nativeButton={false}
                    size="sm"
                    variant="outline"
                    render={
                      <Link
                        href={`/league/${leagueSlug}/scores/${meeting.publicId || meeting.id}`}
                      />
                    }
                  >
                    <HugeiconsIcon
                      icon={TvMinimalIcon}
                      strokeWidth={1.5}
                      data-icon="inline-start"
                    />
                    View Matchup
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  );
}
