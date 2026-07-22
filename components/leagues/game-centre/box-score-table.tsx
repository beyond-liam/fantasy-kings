"use client";

import { PlayerIdentity } from "@/components/rankings/player-identity";
import { OpponentCell } from "@/components/team/opponent-cell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  GameCentreBoxTeam,
  GameCentrePlayer,
} from "@/lib/queries/game-centre";

const PLACEHOLDER = "—";
/** Shared widths so Opp header/cells align within and across tables. */
const PLAYER_COL = "w-60 min-w-60";
const OPP_COL = "w-24 min-w-24 whitespace-normal text-left";
const PTS_COL = "w-14 min-w-14";

type StatColumn = {
  header: string;
  tooltip: string;
  value: (player: GameCentrePlayer) => string;
};

function num(stats: Record<string, number | null>, key: string) {
  const value = stats[key];
  if (value == null || !Number.isFinite(value)) return PLACEHOLDER;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function sumKeys(
  stats: Record<string, number | null>,
  keys: readonly string[],
) {
  let total = 0;
  let saw = false;
  for (const key of keys) {
    const value = stats[key];
    if (value == null || !Number.isFinite(value)) continue;
    total += value;
    saw = true;
  }
  if (!saw) return PLACEHOLDER;
  return Number.isInteger(total) ? String(total) : total.toFixed(1);
}

function formatPts(value: number | null) {
  if (value == null || !Number.isFinite(value)) return PLACEHOLDER;
  return value.toFixed(1);
}

function StatHead({
  header,
  tooltip,
  className,
}: {
  header: string;
  tooltip: string;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <Tooltip>
        <TooltipTrigger
          render={<span className="inline-flex cursor-default" />}
        >
          {header}
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TableHead>
  );
}

function PtsCell({
  player,
  onActualClick,
}: {
  player: GameCentrePlayer;
  onActualClick?: (player: GameCentrePlayer) => void;
}) {
  const clickable =
    player.actualPts != null &&
    player.scoringBreakdown != null &&
    onActualClick;

  if (clickable) {
    return (
      <button
        type="button"
        onClick={() => onActualClick(player)}
        className="tabular-nums font-medium underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
      >
        {formatPts(player.actualPts)}
      </button>
    );
  }

  return (
    <span className="tabular-nums font-medium">
      {formatPts(player.actualPts)}
    </span>
  );
}

const OFFENSE_COLUMNS: StatColumn[] = [
  {
    header: "CMP",
    tooltip: "Pass completions",
    value: (p) => num(p.stats, "pass_cmp"),
  },
  {
    header: "ATT",
    tooltip: "Pass attempts",
    value: (p) => num(p.stats, "pass_att"),
  },
  {
    header: "TD",
    tooltip: "Pass touchdowns",
    value: (p) => num(p.stats, "pass_td"),
  },
  {
    header: "INT",
    tooltip: "Interceptions thrown",
    value: (p) => num(p.stats, "pass_int"),
  },
  {
    header: "CAR",
    tooltip: "Carries",
    value: (p) => num(p.stats, "rush_att"),
  },
  {
    header: "YDS",
    tooltip: "Rush yards",
    value: (p) => num(p.stats, "rush_yd"),
  },
  {
    header: "TD",
    tooltip: "Rush touchdowns",
    value: (p) => num(p.stats, "rush_td"),
  },
  {
    header: "REC",
    tooltip: "Receptions",
    value: (p) => num(p.stats, "rec"),
  },
  {
    header: "YDS",
    tooltip: "Receiving yards",
    value: (p) => num(p.stats, "rec_yd"),
  },
  {
    header: "TGT",
    tooltip: "Targets",
    value: (p) => num(p.stats, "rec_tgt"),
  },
  {
    header: "TD",
    tooltip: "Receiving touchdowns",
    value: (p) => num(p.stats, "rec_td"),
  },
  {
    header: "FUM",
    tooltip: "Fumbles",
    value: (p) => num(p.stats, "fum"),
  },
  {
    header: "FUML",
    tooltip: "Fumbles lost",
    value: (p) => num(p.stats, "fum_lost"),
  },
];

const KICKER_COLUMNS: StatColumn[] = [
  {
    header: "1-39",
    tooltip: "Field goals made between 1 – 39 yards",
    value: (p) =>
      sumKeys(p.stats, ["fgm_0_19", "fgm_20_29", "fgm_30_39"]),
  },
  {
    header: "40-49",
    tooltip: "Field goals made between 40 – 49 yards",
    value: (p) => num(p.stats, "fgm_40_49"),
  },
  {
    header: "50+",
    tooltip: "Field goals made over 50 yards",
    value: (p) => num(p.stats, "fgm_50p"),
  },
  {
    header: "FG",
    tooltip: "Field goals made",
    value: (p) => num(p.stats, "fgm"),
  },
  {
    header: "FGM",
    tooltip: "Field goals missed",
    value: (p) => num(p.stats, "fgmiss"),
  },
  {
    header: "XP",
    tooltip: "Extra points made",
    value: (p) => num(p.stats, "xpm"),
  },
  {
    header: "XPM",
    tooltip: "Extra points missed",
    value: (p) => num(p.stats, "xpmiss"),
  },
];

const DEFENSE_COLUMNS: StatColumn[] = [
  {
    header: "TCK",
    tooltip: "Tackles",
    value: (p) => {
      const total = num(p.stats, "tkl");
      if (total !== PLACEHOLDER) return total;
      return sumKeys(p.stats, ["tkl_solo", "tkl_ast"]);
    },
  },
  {
    header: "SACK",
    tooltip: "Sacks",
    value: (p) => num(p.stats, "sack"),
  },
  {
    header: "TFL",
    tooltip: "Tackles for a loss",
    value: (p) => num(p.stats, "tkl_loss"),
  },
  {
    header: "INT",
    tooltip: "Interceptions",
    value: (p) => num(p.stats, "int"),
  },
  {
    header: "FF",
    tooltip: "Forced fumbles",
    value: (p) => num(p.stats, "ff"),
  },
  {
    header: "FMR",
    tooltip: "Fumbles recovered",
    value: (p) => num(p.stats, "fum_rec"),
  },
  {
    header: "TD",
    tooltip: "Defensive touchdowns",
    value: (p) => num(p.stats, "def_td"),
  },
  {
    header: "PB",
    tooltip: "Punts blocked",
    value: (p) => num(p.stats, "blk_punt"),
  },
  {
    header: "KB",
    tooltip: "Kicks blocked",
    value: (p) => num(p.stats, "blk_kick"),
  },
  {
    header: "SF",
    tooltip: "Safeties",
    value: (p) => num(p.stats, "safe"),
  },
  {
    header: "RTD",
    tooltip: "Return touchdowns",
    value: (p) => sumKeys(p.stats, ["def_kr_td", "pr_td", "st_td"]),
  },
  {
    header: "RYD",
    tooltip: "Return yards",
    value: (p) => {
      const teamReturn = sumKeys(p.stats, ["def_kr_yd", "def_pr_yd"]);
      if (teamReturn !== PLACEHOLDER) return teamReturn;
      return sumKeys(p.stats, ["kr_yd", "pr_yd"]);
    },
  },
];

function partitionStarters(starters: GameCentrePlayer[]) {
  const kickers: GameCentrePlayer[] = [];
  const defense: GameCentrePlayer[] = [];
  const offense: GameCentrePlayer[] = [];

  for (const player of starters) {
    const pos = player.slotPositionId || player.primaryPositionId;
    if (pos === "K") kickers.push(player);
    else if (pos === "DEF") defense.push(player);
    else offense.push(player);
  }

  return { offense, kickers, defense };
}

function BoxSection({
  title,
  players,
  columns,
  onActualClick,
  leagueSlug,
}: {
  title: string;
  players: GameCentrePlayer[];
  columns: StatColumn[];
  onActualClick?: (player: GameCentrePlayer) => void;
  leagueSlug?: string | null;
}) {
  if (players.length === 0) return null;

  const hasPts = players.some((player) => player.actualPts != null);
  const ptsTotal = players.reduce(
    (sum, player) => sum + (player.actualPts ?? 0),
    0,
  );

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <TableShell>
        <Table className="table-fixed min-w-[60rem]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={PLAYER_COL}>Player</TableHead>
              <TableHead className={OPP_COL}>Opp</TableHead>
              {columns.map((column) => (
                <StatHead
                  key={`${title}-${column.header}-${column.tooltip}`}
                  header={column.header}
                  tooltip={column.tooltip}
                />
              ))}
              <StatHead
                header="PTS"
                tooltip="Fantasy points"
                className={PTS_COL}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player) => (
              <TableRow key={player.id}>
                <TableCell className={PLAYER_COL}>
                  <PlayerIdentity
                    fullName={player.fullName}
                    sleeperId={player.sleeperId}
                    primaryPositionId={player.primaryPositionId}
                    nflTeam={player.nflTeam}
                    injuryStatus={player.injuryStatus}
                    size="sm"
                    playerId={player.id}
                    leagueSlug={leagueSlug}
                  />
                </TableCell>
                <TableCell className={OPP_COL}>
                  <OpponentCell opponent={player.opponent} />
                </TableCell>
                {columns.map((column) => (
                  <TableCell
                    key={`${player.id}-${column.header}-${column.tooltip}`}
                    className="tabular-nums"
                  >
                    {column.value(player)}
                  </TableCell>
                ))}
                <TableCell className={PTS_COL}>
                  <PtsCell player={player} onActualClick={onActualClick} />
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableCell
                colSpan={2 + columns.length}
                className="font-semibold"
              >
                TOTALS
              </TableCell>
              <TableCell className={`${PTS_COL} tabular-nums font-semibold`}>
                {hasPts ? ptsTotal.toFixed(1) : PLACEHOLDER}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableShell>
    </section>
  );
}

type BoxScoreTableProps = {
  team: GameCentreBoxTeam;
  onActualClick?: (player: GameCentrePlayer) => void;
  leagueSlug?: string | null;
};

export function BoxScoreTable({
  team,
  onActualClick,
  leagueSlug,
}: BoxScoreTableProps) {
  const { offense, kickers, defense } = partitionStarters(team.starters);

  return (
    <TooltipProvider>
      <section className="flex flex-col gap-6">
        <h2 className="text-sm font-medium">{team.teamName} Box Score</h2>
        <BoxSection
          title="Offense"
          players={offense}
          columns={OFFENSE_COLUMNS}
          onActualClick={onActualClick}
          leagueSlug={leagueSlug}
        />
        <BoxSection
          title="Kickers"
          players={kickers}
          columns={KICKER_COLUMNS}
          onActualClick={onActualClick}
          leagueSlug={leagueSlug}
        />
        <BoxSection
          title="Team Defense"
          players={defense}
          columns={DEFENSE_COLUMNS}
          onActualClick={onActualClick}
          leagueSlug={leagueSlug}
        />
      </section>
    </TooltipProvider>
  );
}
