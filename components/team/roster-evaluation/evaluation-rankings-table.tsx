"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EvaluationRankRow } from "@/lib/leagues/roster-evaluation/types";
import { cn } from "@/lib/utils";

type EvaluationRankingsTableProps = {
  title: string;
  rows: EvaluationRankRow[];
};

function RankMeter({
  score,
  tone,
}: {
  score: number;
  tone: EvaluationRankRow["tone"];
}) {
  const fill =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : tone === "destructive"
          ? "bg-destructive"
          : "bg-muted-foreground";

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width]", fill)}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

export function EvaluationRankingsTable({
  title,
  rows,
}: EvaluationRankingsTableProps) {
  return (
    <Card size="sm" className="h-full gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-0 py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20 bg-transparent pl-4">Pos</TableHead>
              <TableHead className="bg-transparent">
                <span className="sr-only">Strength</span>
              </TableHead>
              <TableHead className="w-14 bg-transparent pr-4 text-right">
                Rank
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.label}
                className="border-0 hover:bg-transparent"
              >
                <TableCell className="pl-4 font-semibold tabular-nums">
                  {row.label}
                </TableCell>
                <TableCell className="w-full min-w-0">
                  <RankMeter score={row.powerScore} tone={row.tone} />
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums">
                  {row.rankLabel}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
