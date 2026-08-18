import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  formatPoints,
  formatRecord,
  teamInitials,
} from "@/lib/leagues/standings";
import type { DashboardLeagueCard } from "@/lib/queries/dashboard-leagues";
import { cn } from "@/lib/utils";

function MatchupLine({
  matchup,
}: {
  matchup: DashboardLeagueCard["matchup"];
}) {
  if (!matchup) {
    return (
      <p className="mt-1 max-w-full text-xs leading-none text-muted-foreground">
        No matchup yet
      </p>
    );
  }

  if (matchup.kind === "upcoming") {
    return (
      <p className="mt-1 max-w-full truncate text-xs leading-none text-muted-foreground">
        Wk {matchup.week} vs {matchup.opponentName}
      </p>
    );
  }

  const resultClass =
    matchup.result === "W"
      ? "text-success"
      : matchup.result === "L"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <p className="mt-1 max-w-full truncate text-xs leading-none text-muted-foreground">
      Wk {matchup.week} ·{" "}
      <span className={cn("font-medium tabular-nums", resultClass)}>
        {matchup.result}
      </span>{" "}
      <span className="tabular-nums">
        {formatPoints(matchup.ownPts)}–{formatPoints(matchup.oppPts)}
      </span>{" "}
      vs {matchup.opponentName}
    </p>
  );
}

function LeagueCard({ league }: { league: DashboardLeagueCard }) {
  return (
    <Link
      href={`/league/${league.publicId}`}
      className="block h-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Card size="sm" className="h-full gap-0 py-0">
        <CardHeader variant="panel">
          <CardTitle className="text-base text-balance">{league.name}</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="flex flex-col items-center gap-2">
              <Avatar size="hero">
                {league.logoUrl ? (
                  <AvatarImage src={league.logoUrl} alt="" />
                ) : null}
                <AvatarFallback>{teamInitials(league.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 max-w-full text-center">
                <p className="truncate text-sm font-semibold text-balance">
                  {league.teamName ?? "No team"}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 max-w-full flex-col items-center">
              <p className="text-2xl font-semibold leading-none tracking-tight tabular-nums">
                {formatRecord(league.wins, league.losses, league.ties)}
              </p>
              <MatchupLine matchup={league.matchup} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function MyLeaguesCarousel({
  leagues,
}: {
  leagues: DashboardLeagueCard[];
}) {
  return (
    <Carousel opts={{ align: "start" }} className="w-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-balance">
          My Leagues
        </h2>
        <div className="flex items-center gap-2">
          <CarouselPrevious className="static inset-auto top-auto left-auto right-auto translate-none" />
          <CarouselNext className="static inset-auto top-auto left-auto right-auto translate-none" />
        </div>
      </div>
      <CarouselContent>
        {leagues.map((league) => (
          <CarouselItem
            key={league.id}
            className="basis-full md:basis-1/2 lg:basis-1/3"
          >
            <LeagueCard league={league} />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
