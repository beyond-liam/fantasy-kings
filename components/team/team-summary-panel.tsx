"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { ManagerPresenceIndicator } from "@/components/leagues/presence/manager-presence-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TABLE_ENTITY_LINK_CLASSNAME } from "@/components/ui/table";
import { leagueMatchupPath } from "@/lib/leagues/utils";
import type {
  TeamSummaryMatchupRef,
  TeamSummaryRosterBreakdown,
} from "@/lib/leagues/team-summary";
import { cn } from "@/lib/utils";

type TeamSummaryPanelProps = {
  leagueSlug: string;
  waiverPriorityLabel: string | null;
  ownerName: string | null;
  ownerUserId?: string | null;
  previous: TeamSummaryMatchupRef | null;
  current: TeamSummaryMatchupRef | null;
  breakdown: TeamSummaryRosterBreakdown;
  className?: string;
};

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="min-w-0 text-right text-sm font-medium tabular-nums text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

function resultLetter(result: TeamSummaryMatchupRef["result"]) {
  if (result === "win") return "W";
  if (result === "loss") return "L";
  if (result === "tie") return "T";
  return null;
}

function resultClassName(result: TeamSummaryMatchupRef["result"]) {
  if (result === "win") return "text-success";
  if (result === "loss") return "text-destructive";
  return "text-muted-foreground";
}

function OpponentLink({
  leagueSlug,
  matchup,
}: {
  leagueSlug: string;
  matchup: TeamSummaryMatchupRef;
}) {
  const href = leagueMatchupPath(
    leagueSlug,
    matchup.publicId || String(matchup.week),
  );

  return (
    <Link
      href={href}
      className={cn(TABLE_ENTITY_LINK_CLASSNAME, "text-foreground")}
    >
      {matchup.isHome ? "" : "@"}
      {matchup.opponentName}
    </Link>
  );
}

function MatchupValue({
  leagueSlug,
  matchup,
  showResult,
}: {
  leagueSlug: string;
  matchup: TeamSummaryMatchupRef | null;
  showResult?: boolean;
}) {
  if (!matchup) {
    return <span>—</span>;
  }

  const letter = showResult ? resultLetter(matchup.result) : null;

  return (
    <span className="inline-flex max-w-full items-baseline justify-end gap-1.5">
      {letter ? (
        <span className={cn("shrink-0 font-bold", resultClassName(matchup.result))}>
          {letter}
        </span>
      ) : null}
      <span className="min-w-0 truncate text-foreground">
        <OpponentLink leagueSlug={leagueSlug} matchup={matchup} />
      </span>
    </span>
  );
}

function RosterCountRow({
  count,
  label,
  range,
  illegal,
}: {
  count: number;
  label: string;
  range: string;
  illegal?: boolean;
}) {
  return (
    <li className="flex items-baseline gap-2 tabular-nums">
      <span
        className={cn(
          "w-4 shrink-0 font-medium",
          illegal ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {count}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 font-medium",
          illegal ? "text-destructive" : "text-foreground",
        )}
      >
        {label}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{range}</span>
    </li>
  );
}

export function TeamSummaryPanel({
  leagueSlug,
  waiverPriorityLabel,
  ownerName,
  ownerUserId,
  previous,
  current,
  breakdown,
  className,
}: TeamSummaryPanelProps) {
  return (
    <Card size="sm" className={cn("w-full gap-0 py-0", className)}>
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">Roster Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          {waiverPriorityLabel ? (
            <MetaRow label="Waiver Priority">{waiverPriorityLabel}</MetaRow>
          ) : null}
          <MetaRow label="Owner">
            <span className="inline-flex min-w-0 items-center justify-end gap-1.5 truncate text-foreground">
              <ManagerPresenceIndicator userId={ownerUserId} />
              {ownerName?.trim() || "—"}
            </span>
          </MetaRow>
          <MetaRow label="Previous">
            <MatchupValue
              leagueSlug={leagueSlug}
              matchup={previous}
              showResult
            />
          </MetaRow>
          <MetaRow label="Current">
            <MatchupValue leagueSlug={leagueSlug} matchup={current} />
          </MetaRow>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">Roster</h3>
          <ul className="flex flex-col gap-1.5">
            {breakdown.positions.map((row) => (
              <RosterCountRow
                key={row.positionId}
                count={row.count}
                label={row.label}
                range={`${row.min}-${row.max}`}
                illegal={row.illegal}
              />
            ))}
            <RosterCountRow
              count={breakdown.starters.count}
              label="Start"
              range={`${breakdown.starters.max} max`}
            />
            <RosterCountRow
              count={breakdown.active.count}
              label="Active"
              range={`${breakdown.active.max} max`}
            />
            {breakdown.ir ? (
              <RosterCountRow
                count={breakdown.ir.count}
                label="IR"
                range={`${breakdown.ir.max} max`}
                illegal={breakdown.ir.illegal}
              />
            ) : null}
            {breakdown.taxi ? (
              <RosterCountRow
                count={breakdown.taxi.count}
                label="Taxi"
                range={`${breakdown.taxi.max} max`}
                illegal={breakdown.taxi.illegal}
              />
            ) : null}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
