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
  const clickable = player.actualPts != null && onActualClick;

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
    header: "FGA",
    tooltip: "Field goal attempts",
    value: (p) => num(p.stats, "fga"),
  },
  {
    header: "FGM",
    tooltip: "Field goals made",
    value: (p) => num(p.stats, "fgm"),
  },
  {
    header: "40-49",
    tooltip: "Field goals made from 40–49 yards",
    value: (p) => num(p.stats, "fgm_40_49"),
  },
  {
    header: "50+",
    tooltip: "Field goals made from 50+ yards",
    value: (p) => num(p.stats, "fgm_50p"),
  },
  {
    header: "XPA",
    tooltip: "Extra point attempts",
    value: (p) => num(p.stats, "xpa"),
  },
  {
    header: "XPM",
    tooltip: "Extra points made",
    value: (p) => num(p.stats, "xpm"),
  },
];

const TEAM_DEF_COLUMNS: StatColumn[] = [
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
    header: "FR",
    tooltip: "Fumble recoveries",
    value: (p) => num(p.stats, "fum_rec"),
  },
  {
    header: "DEF TD",
    tooltip: "Defensive touchdowns",
    value: (p) => num(p.stats, "def_td"),
  },
  {
    header: "ST TD",
    tooltip: "Special teams touchdowns",
    value: (p) => num(p.stats, "st_td"),
  },
  {
    header: "KR TD",
    tooltip: "Kick return touchdowns",
    value: (p) => num(p.stats, "def_kr_td"),
  },
  {
    header: "PA",
    tooltip: "Points allowed",
    value: (p) => num(p.stats, "pts_allow"),
  },
];

const IDP_COLUMNS: StatColumn[] = [
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
    header: "TFL",
    tooltip: "Tackles for a loss",
    value: (p) => num(p.stats, "tkl_loss"),
  },
  {
    header: "SACK",
    tooltip: "Sacks",
    value: (p) => num(p.stats, "sack"),
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
    header: "FR",
    tooltip: "Fumble recoveries",
    value: (p) => num(p.stats, "fum_rec"),
  },
  {
    header: "TD",
    tooltip: "Defensive touchdowns",
    value: (p) => num(p.stats, "def_td"),
  },
];

function partitionStarters(starters: GameCentrePlayer[]) {
  const kickers: GameCentrePlayer[] = [];
  const teamDefense: GameCentrePlayer[] = [];
  const idp: GameCentrePlayer[] = [];
  const offense: GameCentrePlayer[] = [];

  for (const player of starters) {
    const pos = player.slotPositionId || player.primaryPositionId;
    if (pos === "K") kickers.push(player);
    else if (pos === "DEF") teamDefense.push(player);
    else if (
      pos === "CB" ||
      pos === "S" ||
      pos === "DT" ||
      pos === "DE" ||
      pos === "LB"
    ) {
      idp.push(player);
    } else offense.push(player);
  }

  return { offense, kickers, teamDefense, idp };
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
  const { offense, kickers, teamDefense, idp } = partitionStarters(
    team.starters,
  );

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
          players={teamDefense}
          columns={TEAM_DEF_COLUMNS}
          onActualClick={onActualClick}
          leagueSlug={leagueSlug}
        />
        <BoxSection
          title="Defense"
          players={idp}
          columns={IDP_COLUMNS}
          onActualClick={onActualClick}
          leagueSlug={leagueSlug}
        />
      </section>
    </TooltipProvider>
  );
}
