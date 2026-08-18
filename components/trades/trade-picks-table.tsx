"use client";

import { LicenseDraftIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { teamInitials } from "@/lib/leagues/standings";
import { cn } from "@/lib/utils";

export type TradePickRow = {
  id: string;
  primary: string;
  secondary: string | null;
};

type TradePicksTableProps = {
  teamName: string | null;
  picks: TradePickRow[];
  selectedIds: Set<string>;
  onToggle: (pickId: string) => void;
};

export function TradePicksTable({
  teamName,
  picks,
  selectedIds,
  onToggle,
}: TradePicksTableProps) {
  const table =
    picks.length === 0 ? (
      <Empty size="sm">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={LicenseDraftIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>No future picks</EmptyTitle>
          <EmptyDescription>
            This team has no minted draft picks to trade.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Pick</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {picks.map((pick) => {
              const checked = selectedIds.has(pick.id);
              return (
                <TableRow
                  key={pick.id}
                  data-state={checked ? "selected" : undefined}
                  className={cn(checked && "bg-muted/50")}
                >
                  <TableCell>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggle(pick.id)}
                      aria-label={`Select ${pick.primary}`}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium tabular-nums">{pick.primary}</p>
                    {pick.secondary ? (
                      <p className="text-pretty text-muted-foreground">
                        {pick.secondary}
                      </p>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableShell>
    );

  if (!teamName) {
    return table;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar size="sm" className="shrink-0">
          <AvatarFallback>{teamInitials(teamName)}</AvatarFallback>
        </Avatar>
        <h2 className="truncate text-lg font-semibold tracking-tight">
          {teamName}
        </h2>
      </div>
      {table}
    </section>
  );
}
