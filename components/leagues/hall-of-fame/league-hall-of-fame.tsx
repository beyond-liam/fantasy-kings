import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export function LeagueHallOfFame() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Hall of Fame</EmptyTitle>
        <EmptyDescription>
          Champions, cellar, all-time standings, and roast awards will show up
          here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
