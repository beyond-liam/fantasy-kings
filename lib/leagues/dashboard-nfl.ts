export type DashboardNflPlayer = {
  id: string;
  fullName: string;
  sleeperId: string | null;
  primaryPositionId: string;
  nflTeam: string | null;
  value: number;
  line: string;
  ownedPct?: number | null;
};

export type DashboardNflScoreRow = {
  id: string;
  fullName: string;
  sleeperId: string | null;
  primaryPositionId: string;
  nflTeam: string | null;
  stats: Record<string, number | null>;
};

export const STANDARD_TOTW_SLOTS = [
  "QB",
  "RB",
  "RB",
  "WR",
  "WR",
  "TE",
  "FLEX",
  "K",
  "DEF",
] as const;

export type StandardTotwSlot = (typeof STANDARD_TOTW_SLOTS)[number];

export type StandardTotwRow = {
  slot: StandardTotwSlot;
  player: DashboardNflPlayer | null;
};

function statValue(stats: Record<string, number | null>, key: string) {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function pickStatLeader(
  rows: DashboardNflScoreRow[],
  statKey: string,
  line: (value: number) => string,
): DashboardNflPlayer | null {
  let best: DashboardNflPlayer | null = null;
  for (const row of rows) {
    const value = Math.round(statValue(row.stats, statKey) * 10) / 10;
    if (value <= 0) continue;
    if (
      !best ||
      value > best.value ||
      (value === best.value && row.fullName.localeCompare(best.fullName) < 0)
    ) {
      best = {
        id: row.id,
        fullName: row.fullName,
        sleeperId: row.sleeperId,
        primaryPositionId: row.primaryPositionId,
        nflTeam: row.nflTeam,
        value,
        line: line(value),
      };
    }
  }
  return best;
}

export function pickStandardTeamOfTheWeek(
  players: Array<{
    id: string;
    fullName: string;
    sleeperId: string | null;
    primaryPositionId: string;
    nflTeam: string | null;
    points: number;
  }>,
): StandardTotwRow[] {
  const used = new Set<string>();

  const take = (positions: ReadonlySet<string>): DashboardNflPlayer | null => {
    let best: (typeof players)[number] | null = null;
    for (const player of players) {
      if (used.has(player.id)) continue;
      if (!positions.has(player.primaryPositionId)) continue;
      if (player.points <= 0) continue;
      if (
        !best ||
        player.points > best.points ||
        (player.points === best.points &&
          player.fullName.localeCompare(best.fullName) < 0)
      ) {
        best = player;
      }
    }
    if (!best) return null;
    used.add(best.id);
    return {
      id: best.id,
      fullName: best.fullName,
      sleeperId: best.sleeperId,
      primaryPositionId: best.primaryPositionId,
      nflTeam: best.nflTeam,
      value: Math.round(best.points * 10) / 10,
      line: `${(Math.round(best.points * 10) / 10).toFixed(1)} pts`,
    };
  };

  return STANDARD_TOTW_SLOTS.map((slot) => ({
    slot,
    player:
      slot === "FLEX"
        ? take(new Set(["RB", "WR", "TE"]))
        : take(new Set([slot])),
  }));
}
