"use client";

import { useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AddTeamIcon, LeftToRightListNumberIcon } from "@hugeicons/core-free-icons";
import type {
  ColumnDef,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";

import { TeamIdentity } from "@/components/leagues/standings/team-identity";
import { TeamTableColumnHeader } from "@/components/team/team-table-column-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableColumnHeader,
  DataTableViewOptions,
  useDataTable,
} from "@/components/ui/data-table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { claimTeam } from "@/lib/actions/leagues";
import { formatPlayoffOdds } from "@/lib/leagues/playoff-odds";
import type { PlayoffPictureStatus } from "@/lib/leagues/playoff-picture";
import {
  formatGamesBehind,
  formatPoints,
  formatRecord,
  formatWinPct,
  streakSortValue,
  teamInitials,
  type LeagueStandingsRow,
  type StandingsFormGame,
} from "@/lib/leagues/standings";
import type { LeaguePlayoffStandingsRow } from "@/lib/leagues/playoff-standings";
import { formatSos } from "@/lib/leagues/sos";
import { leagueTeamPath, myTeamPath } from "@/lib/leagues/utils";
import { compareNullableNumber } from "@/lib/rankings/stat-helpers";
import { cn } from "@/lib/utils";

type StandingsTableRow = LeagueStandingsRow | LeaguePlayoffStandingsRow;

type LeagueStandingsTableProps = {
  rows: StandingsTableRow[];
  showFaabBudget?: boolean;
  leagueSlug: string;
  myTeamSlug?: string | null;
  /** When set, unclaimed rows show Claim Team (invite/recruit flow). */
  inviteCode?: string | null;
  canClaim?: boolean;
  title?: string;
  /** Show Seed column (playoffs view). Rows should include `seed`. */
  showSeed?: boolean;
  /** Draw a hard line under this seed (last playoff berth). */
  playoffCutoffSeed?: number | null;
};

const PLACEHOLDER = "—";

const COLUMN_LABELS: Record<string, string> = {
  seed: "Seed",
  team: "Team",
  rec: "Record",
  pct: "Win percentage",
  gb: "Games behind",
  strk: "Streak",
  pf: "Points for",
  pfAvg: "Points for average",
  pa: "Points against",
  paAvg: "Points against average",
  sos: "Strength of schedule",
  odds: "Playoff chance",
  status: "Playoff picture",
  wp: "Waiver priority",
  faab: "Budget remaining",
  rank: "Rank",
  form: "Form",
  action: "Action",
};

function playoffStatusLabel(status: PlayoffPictureStatus) {
  if (status === "clinched") return "In";
  if (status === "eliminated") return "Out";
  return "Bubble";
}

function PlayoffStatusBadge({ status }: { status: PlayoffPictureStatus }) {
  const label = playoffStatusLabel(status);
  const variant =
    status === "clinched"
      ? "success"
      : status === "eliminated"
        ? "destructive"
        : "warning";
  return <Badge variant={variant}>{label}</Badge>;
}

function oddsClassName(odds: number) {
  if (odds >= 0.7) return "text-success font-medium";
  if (odds <= 0.3) return "text-destructive font-medium";
  return "text-muted-foreground";
}

function formResultLabel(result: StandingsFormGame["result"]) {
  if (result === "W") return "Win";
  if (result === "L") return "Loss";
  return "Tie";
}

function FormGuideCell({ games }: { games: StandingsFormGame[] }) {
  if (games.length === 0) {
    return <span className="text-muted-foreground">{PLACEHOLDER}</span>;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1" aria-label="Last five results">
        {games.map((game, index) => (
          <Tooltip key={`${game.week}-${game.opponentName}-${index}`}>
            <TooltipTrigger
              render={
                <span
                  className={cn(
                    "inline-flex size-4 shrink-0 cursor-pointer rounded-sm",
                    game.result === "W" && "bg-success",
                    game.result === "L" && "bg-destructive",
                    game.result === "T" && "bg-slate-600",
                  )}
                  aria-label={`${formResultLabel(game.result)} vs ${game.opponentName}`}
                />
              }
            />
            <TooltipContent>
              Week {game.week}: {formResultLabel(game.result)} vs{" "}
              {game.opponentName} ({formatPoints(game.ownPts)}–
              {formatPoints(game.oppPts)})
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

function claimedFirst(
  rowA: { original: StandingsTableRow },
  rowB: { original: StandingsTableRow },
  compare: () => number,
) {
  if (rowA.original.claimed !== rowB.original.claimed) {
    return rowA.original.claimed ? -1 : 1;
  }
  return compare();
}

function ClaimTeamButton({
  inviteCode,
  teamId,
}: {
  inviteCode: string;
  teamId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await claimTeam(inviteCode, teamId);
            if (result?.error) {
              setError(result.error);
            }
          });
        }}
      >
        <HugeiconsIcon
          icon={AddTeamIcon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Claim Team
      </Button>
      {error ? (
        <span className="max-w-40 text-right text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Invite/recruit mobile rows: team + record under name + claim. */
function MobileInviteStandings({
  rows,
  inviteCode,
  canClaim,
}: {
  rows: StandingsTableRow[];
  inviteCode: string;
  canClaim: boolean;
}) {
  return (
    <ul className="flex flex-col">
      {rows.map((row) => {
        const record = formatRecord(row.wins, row.losses, row.ties);
        const showClaim =
          canClaim && !row.claimed && Boolean(row.teamId);

        return (
          <li
            key={row.id}
            className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
          >
            {row.claimed ? (
              <Avatar size="sm" className="shrink-0">
                {row.logoUrl ? <AvatarImage src={row.logoUrl} alt="" /> : null}
                <AvatarFallback>{teamInitials(row.teamName)}</AvatarFallback>
              </Avatar>
            ) : (
              <div
                className="size-6 shrink-0 rounded-full bg-muted"
                aria-hidden
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span
                className={cn(
                  "truncate text-sm",
                  row.claimed ? "font-medium" : "text-muted-foreground",
                )}
              >
                {row.teamName}
              </span>
              <span className="tabular-nums text-xs text-muted-foreground">
                {record}
              </span>
            </div>
            {showClaim && row.teamId ? (
              <ClaimTeamButton inviteCode={inviteCode} teamId={row.teamId} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function getStandingsColumns(
  showFaabBudget: boolean,
  leagueSlug: string,
  myTeamSlug: string | null | undefined,
  inviteCode: string | null | undefined,
  canClaim: boolean,
  showSeed: boolean,
): ColumnDef<StandingsTableRow>[] {
  const wpColumn: ColumnDef<StandingsTableRow> = {
    id: "wp",
    accessorFn: (row) => (row.claimed ? row.waiverPriority : null),
    enableSorting: true,
    sortingFn: (a, b) =>
      claimedFirst(a, b, () =>
        compareNullableNumber(
          a.getValue<number | null>("wp"),
          b.getValue<number | null>("wp"),
        ),
      ),
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="WP"
        tooltip="Waiver priority"
      />
    ),
    cell: ({ row }) =>
      row.original.claimed
        ? (row.original.waiverPriority ?? PLACEHOLDER)
        : PLACEHOLDER,
    meta: { cellClassName: "tabular-nums" },
  };

  const faabColumn: ColumnDef<StandingsTableRow> = {
    id: "faab",
    accessorFn: (row) => (row.claimed ? row.faabRemaining : null),
    enableSorting: true,
    sortingFn: (a, b) =>
      claimedFirst(a, b, () =>
        compareNullableNumber(
          a.getValue<number | null>("faab"),
          b.getValue<number | null>("faab"),
        ),
      ),
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="BRM"
        tooltip="Waiver budget remaining"
      />
    ),
    cell: ({ row }) =>
      row.original.claimed && row.original.faabRemaining != null
        ? `$${row.original.faabRemaining}`
        : PLACEHOLDER,
    meta: { cellClassName: "tabular-nums" },
  };

  const seedColumn: ColumnDef<StandingsTableRow> = {
    id: "seed",
    accessorFn: (row) => ("seed" in row ? row.seed : null),
    enableSorting: true,
    enableHiding: false,
    size: 56,
    sortingFn: (a, b) =>
      claimedFirst(a, b, () =>
        compareNullableNumber(
          a.getValue<number | null>("seed"),
          b.getValue<number | null>("seed"),
        ),
      ),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Seed" tooltip="Playoff seed" />
    ),
    cell: ({ row }) => {
      const seed = "seed" in row.original ? row.original.seed : null;
      return seed != null ? `#${seed}` : PLACEHOLDER;
    },
    meta: { width: 56, sticky: "left", cellClassName: "tabular-nums" },
  };

  const rankColumn: ColumnDef<StandingsTableRow> = {
    id: "rank",
    accessorFn: (row) => (row.claimed ? row.rank : null),
    enableSorting: true,
    sortingFn: (a, b) =>
      claimedFirst(a, b, () =>
        compareNullableNumber(
          a.getValue<number | null>("rank"),
          b.getValue<number | null>("rank"),
        ),
      ),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="RK" tooltip="Rank" />
    ),
    cell: ({ row }) =>
      row.original.claimed
        ? (row.original.rank ?? PLACEHOLDER)
        : PLACEHOLDER,
    meta: { cellClassName: "tabular-nums" },
  };

  const columns: ColumnDef<StandingsTableRow>[] = [
    ...(showSeed ? [seedColumn] : []),
    {
      id: "team",
      accessorFn: (row) => row.teamName,
      enableSorting: false,
      enableHiding: false,
      size: 220,
      meta: { width: 220, sticky: "left" },
      header: () => <TeamTableColumnHeader title="Team" />,
      cell: ({ row }) => {
        const team = row.original;
        let href: string | null = null;
        if (team.claimed && team.teamPublicId) {
          href =
            myTeamSlug && team.teamPublicId === myTeamSlug
              ? myTeamPath(leagueSlug)
              : leagueTeamPath(leagueSlug, team.teamPublicId);
        }
        return (
          <TeamIdentity
            teamName={team.teamName}
            ownerName={team.ownerName}
            ownerUserId={team.ownerUserId}
            claimed={team.claimed}
            logoUrl={team.logoUrl}
            href={href}
          />
        );
      },
    },
    {
      id: "rec",
      accessorFn: (row) =>
        row.claimed ? row.wins + row.ties * 0.5 - row.losses * 0.001 : null,
      enableSorting: true,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("rec"),
            b.getValue<number | null>("rec"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="REC" tooltip="Record" />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? formatRecord(
              row.original.wins,
              row.original.losses,
              row.original.ties,
            )
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "pct",
      accessorFn: (row) => (row.claimed ? row.winPct : null),
      enableSorting: true,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("pct"),
            b.getValue<number | null>("pct"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="W%"
          tooltip="Win percentage"
        />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? formatWinPct(row.original.winPct)
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "gb",
      accessorFn: (row) => (row.claimed ? (row.gamesBehind ?? 0) : null),
      enableSorting: true,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("gb"),
            b.getValue<number | null>("gb"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="GB"
          tooltip="Games behind"
        />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? formatGamesBehind(row.original.gamesBehind)
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "strk",
      accessorFn: (row) =>
        row.claimed ? streakSortValue(row.streak) : null,
      enableSorting: true,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("strk"),
            b.getValue<number | null>("strk"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="STRK" tooltip="Streak" />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? (row.original.streak ?? PLACEHOLDER)
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "sos",
      accessorFn: (row) =>
        row.claimed
          ? showSeed
            ? row.sosRemaining
            : row.sos
          : null,
      enableSorting: true,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("sos"),
            b.getValue<number | null>("sos"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="SOS"
          tooltip={
            showSeed
              ? "Remaining strength of schedule"
              : "Strength of schedule"
          }
        />
      ),
      cell: ({ row }) => {
        if (!row.original.claimed) return PLACEHOLDER;
        const value = showSeed
          ? row.original.sosRemaining
          : row.original.sos;
        return formatSos(value) ?? PLACEHOLDER;
      },
      meta: { cellClassName: "tabular-nums" },
    },
    ...(showSeed
      ? ([
          {
            id: "odds",
            accessorFn: (row) =>
              "playoffOdds" in row ? row.playoffOdds : null,
            enableSorting: true,
            sortingFn: (a, b) =>
              claimedFirst(a, b, () =>
                compareNullableNumber(
                  a.getValue<number | null>("odds"),
                  b.getValue<number | null>("odds"),
                ),
              ),
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title="Odds"
                tooltip="Playoff chance"
              />
            ),
            cell: ({ row }) => {
              if (!row.original.claimed) return PLACEHOLDER;
              const odds =
                "playoffOdds" in row.original
                  ? row.original.playoffOdds
                  : null;
              const label = formatPlayoffOdds(odds);
              if (label == null || odds == null) return PLACEHOLDER;
              return (
                <span className={cn("tabular-nums", oddsClassName(odds))}>
                  {label}
                </span>
              );
            },
            meta: { cellClassName: "tabular-nums" },
          },
          {
            id: "status",
            accessorFn: (row) =>
              "playoffStatus" in row ? row.playoffStatus : null,
            enableSorting: true,
            sortingFn: (a, b) =>
              claimedFirst(a, b, () => {
                const order = { clinched: 0, bubble: 1, eliminated: 2 } as const;
                const aStatus = a.getValue<PlayoffPictureStatus | null>("status");
                const bStatus = b.getValue<PlayoffPictureStatus | null>("status");
                return (
                  (aStatus ? order[aStatus] : 3) -
                  (bStatus ? order[bStatus] : 3)
                );
              }),
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title="Status"
                tooltip="Playoff picture"
              />
            ),
            cell: ({ row }) => {
              if (!row.original.claimed) return PLACEHOLDER;
              const status =
                "playoffStatus" in row.original
                  ? row.original.playoffStatus
                  : null;
              if (!status) return PLACEHOLDER;
              return <PlayoffStatusBadge status={status} />;
            },
          },
        ] as ColumnDef<StandingsTableRow>[])
      : []),
    ...(showSeed
      ? []
      : ([
          {
            id: "pf",
            accessorFn: (row) => (row.claimed ? row.pointsFor : null),
            enableSorting: true,
            sortingFn: (a, b) =>
              claimedFirst(a, b, () =>
                compareNullableNumber(
                  a.getValue<number | null>("pf"),
                  b.getValue<number | null>("pf"),
                ),
              ),
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title="PF"
                tooltip="Points for"
              />
            ),
            cell: ({ row }) =>
              row.original.claimed
                ? formatPoints(row.original.pointsFor)
                : PLACEHOLDER,
            meta: { cellClassName: "tabular-nums" },
          },
          {
            id: "pfAvg",
            accessorFn: (row) => (row.claimed ? row.pointsForAvg : null),
            enableSorting: true,
            sortingFn: (a, b) =>
              claimedFirst(a, b, () =>
                compareNullableNumber(
                  a.getValue<number | null>("pfAvg"),
                  b.getValue<number | null>("pfAvg"),
                ),
              ),
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title="PF/G"
                tooltip="Points for average"
              />
            ),
            cell: ({ row }) =>
              row.original.claimed
                ? formatPoints(row.original.pointsForAvg)
                : PLACEHOLDER,
            meta: { cellClassName: "tabular-nums" },
          },
          {
            id: "pa",
            accessorFn: (row) => (row.claimed ? row.pointsAgainst : null),
            enableSorting: true,
            sortingFn: (a, b) =>
              claimedFirst(a, b, () =>
                compareNullableNumber(
                  a.getValue<number | null>("pa"),
                  b.getValue<number | null>("pa"),
                ),
              ),
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title="PA"
                tooltip="Points against"
              />
            ),
            cell: ({ row }) =>
              row.original.claimed
                ? formatPoints(row.original.pointsAgainst)
                : PLACEHOLDER,
            meta: { cellClassName: "tabular-nums" },
          },
          {
            id: "paAvg",
            accessorFn: (row) => (row.claimed ? row.pointsAgainstAvg : null),
            enableSorting: true,
            sortingFn: (a, b) =>
              claimedFirst(a, b, () =>
                compareNullableNumber(
                  a.getValue<number | null>("paAvg"),
                  b.getValue<number | null>("paAvg"),
                ),
              ),
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title="PA/G"
                tooltip="Points against average"
              />
            ),
            cell: ({ row }) =>
              row.original.claimed
                ? formatPoints(row.original.pointsAgainstAvg)
                : PLACEHOLDER,
            meta: { cellClassName: "tabular-nums" },
          },
          wpColumn,
          ...(showFaabBudget ? [faabColumn] : []),
          rankColumn,
        ] as ColumnDef<StandingsTableRow>[])),
    {
      id: "form",
      accessorFn: (row) => row.form.length,
      enableSorting: false,
      header: () => (
        <TeamTableColumnHeader title="FORM" tooltip="Last five results" />
      ),
      cell: ({ row }) =>
        row.original.claimed ? (
          <FormGuideCell games={row.original.form ?? []} />
        ) : (
          PLACEHOLDER
        ),
    },
  ];

  if (canClaim && inviteCode) {
    columns.push({
      id: "action",
      enableSorting: false,
      enableHiding: false,
      header: () => <TeamTableColumnHeader title="" />,
      cell: ({ row }) => {
        if (row.original.claimed || !row.original.teamId) {
          return null;
        }
        return (
          <ClaimTeamButton
            inviteCode={inviteCode}
            teamId={row.original.teamId}
          />
        );
      },
    });
  }

  return columns;
}

export function LeagueStandingsTable({
  rows,
  showFaabBudget = false,
  leagueSlug,
  myTeamSlug,
  inviteCode,
  canClaim = false,
  title = "Standings",
  showSeed = false,
  playoffCutoffSeed = null,
}: LeagueStandingsTableProps) {
  const isMobile = useIsMobile();
  const inviteMobile = Boolean(inviteCode) && isMobile;
  const [sorting, setSorting] = useState<SortingState>([
    { id: showSeed ? "seed" : "rank", desc: false },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    {},
  );

  const columns = getStandingsColumns(
    showFaabBudget,
    leagueSlug,
    myTeamSlug,
    inviteCode,
    canClaim,
    showSeed,
  );
  const table = useDataTable({
    data: rows,
    columns,
    sorting,
    onSortingChange: setSorting,
    columnVisibility,
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (row) => row.id,
    pageSize: Math.max(rows.length, 1),
  });

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={LeftToRightListNumberIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>No team slots configured</EmptyTitle>
          <EmptyDescription>
            Configure league size in settings to create team slots.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {inviteMobile ? null : (
          <DataTableViewOptions table={table} labels={COLUMN_LABELS} />
        )}
      </div>
      {inviteMobile && inviteCode ? (
        <MobileInviteStandings
          rows={rows}
          inviteCode={inviteCode}
          canClaim={canClaim}
        />
      ) : (
        <DataTable
          table={table}
          showPagination={false}
          emptyMessage="No team slots configured for this league."
          getRowClassName={(row) => {
            if (playoffCutoffSeed == null || !("seed" in row.original)) {
              return undefined;
            }
            const { seed } = row.original;
            return cn(
              seed === playoffCutoffSeed && "border-b-2! border-border!",
              seed > playoffCutoffSeed && "text-muted-foreground",
            );
          }}
        />
      )}
    </div>
  );
}
