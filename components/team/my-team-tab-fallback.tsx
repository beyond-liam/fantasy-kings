import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";

export function MyTeamTabFallback() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyDescription>Loading…</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
