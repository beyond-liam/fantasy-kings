"use client";

import { ScheduleTeamLogo } from "@/components/scores/schedule-team-logo";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  GameBoxScore,
  GameBoxScoreCategory,
  GameBoxScoreColumn,
  GameBoxScoreSide,
} from "@/lib/espn/game-box-score";

type TeamMeta = {
  abbreviation: string;
  nickname: string;
  logoUrl: string;
};

type PlayerBoxScoreProps = {
  boxScore: GameBoxScore;
  away: TeamMeta;
  home: TeamMeta;
};

const PLAYER_COL = "w-48 max-w-48";

function StatCells({ values }: { values: string[] }) {
  return values.map((value, index) => (
    <TableCell key={`${value}-${index}`} className="text-right tabular-nums">
      {value}
    </TableCell>
  ));
}

function HeaderLabel({ column }: { column: GameBoxScoreColumn }) {
  if (!column.description) {
    return column.label;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button type="button" className="cursor-help">
            {column.label}
          </button>
        }
      />
      <TooltipContent>{column.description}</TooltipContent>
    </Tooltip>
  );
}

function CategoryTable({
  category,
  logoUrl,
}: {
  category: GameBoxScoreCategory;
  logoUrl: string;
}) {
  const colSpan = category.columns.length + 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {logoUrl ? (
          <ScheduleTeamLogo src={logoUrl} size={20} className="size-5" />
        ) : null}
        <h3 className="text-sm font-semibold text-balance">{category.title}</h3>
      </div>
      <TableShell>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className={PLAYER_COL}>
                <span className="sr-only">Player</span>
              </TableHead>
              {category.columns.map((column) => (
                <TableHead key={column.label} className="text-right">
                  <HeaderLabel column={column} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {category.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="text-muted-foreground"
                >
                  No {category.title}
                </TableCell>
              </TableRow>
            ) : (
              category.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className={cn(PLAYER_COL, "truncate font-medium")}>
                    {row.name}
                  </TableCell>
                  <StatCells values={row.stats} />
                </TableRow>
              ))
            )}
          </TableBody>
          {category.totals ? (
            <TableFooter>
              <TableRow>
                <TableCell className={PLAYER_COL}>TEAM</TableCell>
                <StatCells values={category.totals} />
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </TableShell>
    </div>
  );
}

function TeamBoxScore({
  side,
  logoUrl,
}: {
  side: GameBoxScoreSide;
  logoUrl: string;
}) {
  if (side.categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No box score yet</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {side.categories.map((category) => (
        <CategoryTable
          key={category.name}
          category={category}
          logoUrl={logoUrl}
        />
      ))}
    </div>
  );
}

export function PlayerBoxScore({ boxScore, away, home }: PlayerBoxScoreProps) {
  return (
    <TooltipProvider>
      <Tabs defaultValue="away">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="away">
            {away.logoUrl ? (
              <ScheduleTeamLogo
                src={away.logoUrl}
                size={16}
                className="size-4"
              />
            ) : null}
            {away.nickname || away.abbreviation}
          </TabsTrigger>
          <TabsTrigger value="home">
            {home.logoUrl ? (
              <ScheduleTeamLogo
                src={home.logoUrl}
                size={16}
                className="size-4"
              />
            ) : null}
            {home.nickname || home.abbreviation}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="away">
          <TeamBoxScore side={boxScore.away} logoUrl={away.logoUrl} />
        </TabsContent>
        <TabsContent value="home">
          <TeamBoxScore side={boxScore.home} logoUrl={home.logoUrl} />
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}
