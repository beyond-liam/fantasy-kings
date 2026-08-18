import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { HofHashScroll } from "@/components/leagues/hall-of-fame/hof-hash-scroll";
import { TeamSpotlight } from "@/components/leagues/team-spotlight";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { LeagueHallOfFameData } from "@/lib/leagues/hall-of-fame";
import {
  formatPoints,
  formatRecord,
  formatWinPct,
  teamInitials,
} from "@/lib/leagues/standings";

export const HOF_ALL_TIME_TABLE_ID = "hof-all-time-table";

function HofCard({
  title,
  action,
  id,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} size="sm" className="scroll-mt-6 gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">{title}</CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="py-4">{children}</CardContent>
    </Card>
  );
}

function ViewAllLink({ href }: { href: string }) {
  return (
    <Button
      nativeButton={false}
      variant="ghost"
      size="sm"
      className="h-7 shrink-0 px-2 text-xs"
      render={<Link href={href} />}
    >
      View all
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        strokeWidth={2}
        data-icon="inline-end"
      />
    </Button>
  );
}

export type LeagueHallOfFameProps = {
  leagueSlug: string;
  data: LeagueHallOfFameData;
};

export function LeagueHallOfFame({ leagueSlug, data }: LeagueHallOfFameProps) {
  const middleTitle =
    data.middleHonorKind === "division_titles"
      ? "Most Division Titles"
      : "Most Regular Season Titles";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Hall of Fame</h2>
      <HofHashScroll targetId={HOF_ALL_TIME_TABLE_ID} />
      <div className="grid gap-4 sm:grid-cols-3">
        <HofCard
          title="Most Titles"
          action={
            <ViewAllLink
              href={`/league/${leagueSlug}/hall-of-fame/champions`}
            />
          }
        >
          <TeamSpotlight
            row={data.mostTitles}
            leagueSlug={leagueSlug}
            emptyTitle="No champions yet"
            empty="Champions appear after a season ends."
            formatValue={(value) => String(value)}
            valueHint="championships"
          />
        </HofCard>
        <HofCard
          title={middleTitle}
          action={
            <ViewAllLink
              href={
                data.middleHonorKind === "division_titles"
                  ? `/league/${leagueSlug}/hall-of-fame/division-titles`
                  : `/league/${leagueSlug}/hall-of-fame/regular-season`
              }
            />
          }
        >
          <TeamSpotlight
            row={data.middleHonor}
            leagueSlug={leagueSlug}
            emptyTitle="No titles yet"
            empty="Titles appear once seasons finish."
            formatValue={(value) => String(value)}
            valueHint={
              data.middleHonorKind === "division_titles"
                ? "division titles"
                : "#1 finishes"
            }
          />
        </HofCard>
        <HofCard
          title="Most Regular Season Wins"
          action={<ViewAllLink href={`#${HOF_ALL_TIME_TABLE_ID}`} />}
        >
          <TeamSpotlight
            row={data.mostRegularSeasonWins}
            leagueSlug={leagueSlug}
            emptyTitle="No wins yet"
            empty="Regular season results appear after games land."
            formatValue={(value) => String(value)}
            valueHint="wins"
          />
        </HofCard>
      </div>

      <HofCard id={HOF_ALL_TIME_TABLE_ID} title="All Time League Table">
        {data.allTimeTable.length === 0 ? (
          <Empty size="sm">
            <EmptyHeader>
              <EmptyTitle>No standings yet</EmptyTitle>
              <EmptyDescription>
                Career standings appear after finals land.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8 px-2" aria-label="Rank" />
                  <TableHead>Team</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>PF</TableHead>
                  <TableHead>PA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.allTimeTable.map((row, index) => (
                  <TableRow key={row.teamId}>
                    <TableCell className="w-8 px-2 tabular-nums text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar size="sm" className="size-6">
                          {row.logoUrl ? (
                            <AvatarImage src={row.logoUrl} alt="" />
                          ) : null}
                          <AvatarFallback className="text-[10px]">
                            {teamInitials(row.teamName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link
                            href={
                              row.teamPublicId
                                ? `/league/${leagueSlug}/team/${row.teamPublicId}`
                                : `/league/${leagueSlug}`
                            }
                            className="block truncate font-medium underline-offset-2 hover:underline"
                          >
                            {row.teamName}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.ownerName}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatRecord(row.wins, row.losses, row.ties)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatWinPct(row.winPct)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatPoints(row.pointsFor)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatPoints(row.pointsAgainst)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
        )}
      </HofCard>

      <div className="grid gap-4 sm:grid-cols-3">
        <HofCard
          title="Choke Artist"
          action={
            <ViewAllLink href={`/league/${leagueSlug}/hall-of-fame/choke-artist`} />
          }
        >
          <TeamSpotlight
            row={data.chokeArtist}
            leagueSlug={leagueSlug}
            emptyTitle="No collapses yet"
            empty="Late collapses show after close losses."
            formatValue={(value) => String(value)}
            valueClassName="text-destructive"
            valueHint="late collapses"
          />
        </HofCard>
        <HofCard
          title="Fergie Time"
          action={
            <ViewAllLink href={`/league/${leagueSlug}/hall-of-fame/fergie-time`} />
          }
        >
          <TeamSpotlight
            row={data.fergieTime}
            leagueSlug={leagueSlug}
            emptyTitle="No comebacks yet"
            empty="Late comebacks show after close wins."
            formatValue={(value) => String(value)}
            valueHint="late comebacks"
          />
        </HofCard>
        <HofCard
          title="Luckiest Man Alive"
          action={
            <ViewAllLink
              href={`/league/${leagueSlug}/hall-of-fame/luckiest-man-alive`}
            />
          }
        >
          <TeamSpotlight
            row={data.luckiest}
            leagueSlug={leagueSlug}
            emptyTitle="No lucky wins yet"
            empty="Lucky wins appear after close victories."
            formatValue={(value) => String(value)}
            valueHint="lucky wins"
          />
        </HofCard>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <HofCard
          title="Highest Score"
          action={
            <ViewAllLink
              href={`/league/${leagueSlug}/hall-of-fame/highest-winning-score`}
            />
          }
        >
          <TeamSpotlight
            row={data.highestWinningScore}
            leagueSlug={leagueSlug}
            emptyTitle="No scores yet"
            empty="Final scores appear after games finish."
            formatValue={(value) => formatPoints(value)}
            valueHint={
              data.highestWinningScore
                ? `Wk ${data.highestWinningScore.week} vs ${data.highestWinningScore.opponentName}`
                : "single game"
            }
          />
        </HofCard>
        <HofCard
          title="Lowest Score"
          action={
            <ViewAllLink href={`/league/${leagueSlug}/hall-of-fame/lowest-score`} />
          }
        >
          <TeamSpotlight
            row={data.lowestWinningScore}
            leagueSlug={leagueSlug}
            emptyTitle="No scores yet"
            empty="Final scores appear after games finish."
            formatValue={(value) => formatPoints(value)}
            valueHint={
              data.lowestWinningScore
                ? `Wk ${data.lowestWinningScore.week} vs ${data.lowestWinningScore.opponentName}`
                : "single game"
            }
          />
        </HofCard>
      </div>
    </div>
  );
}
