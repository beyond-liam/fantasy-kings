"use client";

import Link from "next/link";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { TABLE_ENTITY_LINK_CLASSNAME } from "@/components/ui/table";
import type { PowerRankTrendEntry } from "@/lib/leagues/power-rankings/trajectory";
import { teamInitials } from "@/lib/leagues/standings";
import { cn } from "@/lib/utils";

type PowerRankingsTrendCardProps = {
  title: string;
  description: string;
  direction: "up" | "down";
  teams: PowerRankTrendEntry[];
  leagueSlug: string;
};

export function PowerRankingsTrendCard({
  title,
  description,
  direction,
  teams,
  leagueSlug,
}: PowerRankingsTrendCardProps) {
  const team = teams[0] ?? null;
  const href =
    team?.teamPublicId != null
      ? `/league/${leagueSlug}/team/${team.teamPublicId}`
      : null;

  return (
    <Card size="sm" className="gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-balance">{title}</CardTitle>
        <CardDescription className="text-pretty">{description}</CardDescription>
      </CardHeader>
      <CardContent className="py-4">
        {!team ? (
          <Empty size="sm" className="min-h-36 border-0 p-0">
            <EmptyHeader>
              <EmptyTitle>
                {direction === "up" ? "No risers yet" : "No fallers yet"}
              </EmptyTitle>
              <EmptyDescription>
                Trends appear once weekly ranks move.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            {href ? (
              <Link
                href={href}
                className={cn(
                  TABLE_ENTITY_LINK_CLASSNAME,
                  "flex flex-col items-center gap-3",
                )}
              >
                <TrendAvatar team={team} />
                <span className="max-w-full text-base font-semibold text-balance">
                  {team.teamName}
                </span>
              </Link>
            ) : (
              <>
                <TrendAvatar team={team} />
                <span className="max-w-full text-base font-semibold text-balance">
                  {team.teamName}
                </span>
              </>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1 text-lg font-semibold tabular-nums",
                direction === "up" ? "text-success" : "text-destructive",
              )}
            >
              <HugeiconsIcon
                icon={direction === "up" ? ArrowUp01Icon : ArrowDown01Icon}
                strokeWidth={2}
                className="size-5"
              />
              {Math.abs(team.rankDelta)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendAvatar({ team }: { team: PowerRankTrendEntry }) {
  return (
    <Avatar className="size-20 text-base">
      {team.logoUrl ? <AvatarImage src={team.logoUrl} alt="" /> : null}
      <AvatarFallback className="text-2xl">{teamInitials(team.teamName)}</AvatarFallback>
    </Avatar>
  );
}

type PowerRankingsMyRankCardProps = {
  title: string;
  description: string;
  rank: number | null;
  teamCount: number;
};

export function PowerRankingsMyRankCard({
  title,
  description,
  rank,
  teamCount,
}: PowerRankingsMyRankCardProps) {
  return (
    <Card size="sm" className="gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-balance">{title}</CardTitle>
        <CardDescription className="text-pretty">{description}</CardDescription>
      </CardHeader>
      <CardContent className="py-4">
        {rank == null || teamCount <= 0 ? (
          <p className="text-3xl font-semibold tracking-tight text-muted-foreground">
            —
          </p>
        ) : (
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {rank}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              of {teamCount}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
