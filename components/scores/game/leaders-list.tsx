import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import type {
  GameLeaderCategory,
  GameLeaderSide,
} from "@/lib/espn/game-summary";
import { getPlayerInitials } from "@/lib/sleeper/avatars";
import { cn } from "@/lib/utils";

function LeaderSide({
  side,
  align,
}: {
  side: GameLeaderSide;
  align: "left" | "right";
}) {
  const isEmpty = side.name === "None";

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <Avatar size="sm" className="bg-muted">
        {side.headshotUrl && !isEmpty ? (
          <AvatarImage src={side.headshotUrl} alt="" />
        ) : null}
        <AvatarFallback>
          {isEmpty ? "—" : getPlayerInitials(side.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {side.name}
          {side.position ? (
            <span className="text-muted-foreground"> {side.position}</span>
          ) : null}
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">{side.line}</p>
      </div>
    </div>
  );
}

export function LeadersList({ leaders }: { leaders: GameLeaderCategory[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {leaders.map((leader) => (
        <li
          key={leader.category}
          className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3"
        >
          <LeaderSide side={leader.away} align="left" />
          <p className="max-w-24 text-center text-[10px] font-medium leading-tight tracking-wide text-muted-foreground uppercase sm:max-w-28">
            {leader.category}
          </p>
          <LeaderSide side={leader.home} align="right" />
        </li>
      ))}
    </ul>
  );
}
