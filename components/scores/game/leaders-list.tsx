import type { GameLeaderCategory } from "@/lib/espn/game-summary";

export function LeadersList({ leaders }: { leaders: GameLeaderCategory[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {leaders.map((leader) => (
        <li
          key={leader.category}
          className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {leader.away.name}
              {leader.away.position ? (
                <span className="text-muted-foreground">
                  {" "}
                  {leader.away.position}
                </span>
              ) : null}
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {leader.away.line}
            </p>
          </div>
          <p className="max-w-24 text-center text-[10px] font-medium leading-tight tracking-wide text-muted-foreground uppercase sm:max-w-28">
            {leader.category}
          </p>
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-medium">
              {leader.home.name}
              {leader.home.position ? (
                <span className="text-muted-foreground">
                  {" "}
                  {leader.home.position}
                </span>
              ) : null}
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {leader.home.line}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
