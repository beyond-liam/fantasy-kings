import type {
  PositionalSosMatchup,
  PositionalSosTable,
} from "@/lib/players/matchup-difficulty";

export type SerializedPositionalSosTable = Array<
  [string, Array<[string, PositionalSosMatchup]>]
>;

export function serializePositionalSosTable(
  table: PositionalSosTable,
): SerializedPositionalSosTable {
  return [...table.entries()].map(([positionId, byTeam]) => [
    positionId,
    [...byTeam.entries()],
  ]);
}

export function deserializePositionalSosTable(
  entries: SerializedPositionalSosTable,
): PositionalSosTable {
  return new Map(
    entries.map(([positionId, teams]) => [positionId, new Map(teams)]),
  );
}
