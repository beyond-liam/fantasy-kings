import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";

export type TeamDraftPickRow = {
  overall: number;
  playerName: string;
  positionId: string;
  nflTeam: string | null;
};

type TeamDraftPicksListProps = {
  picks: TeamDraftPickRow[];
};

export function TeamDraftPicksList({ picks }: TeamDraftPicksListProps) {
  if (picks.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>No draft picks yet</EmptyTitle>
          <EmptyDescription>
            Players drafted by this team will show up here after the draft.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Pick</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="w-24">Pos</TableHead>
            <TableHead className="w-24">Team</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {picks.map((pick) => (
            <TableRow key={pick.overall}>
              <TableCell className="tabular-nums">{pick.overall}</TableCell>
              <TableCell className="font-medium">{pick.playerName}</TableCell>
              <TableCell>{pick.positionId}</TableCell>
              <TableCell className="text-muted-foreground">
                {pick.nflTeam ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}
