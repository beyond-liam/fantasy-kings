import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { ScheduleTeamLogo } from "@/components/scores/schedule-team-logo";
import type {
  GameLeaderCategory,
  GameLeaderSide,
} from "@/lib/espn/game-summary";
import { getPlayerInitials } from "@/lib/sleeper/avatars";
import { cn } from "@/lib/utils";

type TeamMeta = {
  nickname: string;
  logoUrl: string;
};

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

function TeamLeadersStack({
  team,
  leaders,
  sideKey,
}: {
  team: TeamMeta;
  leaders: GameLeaderCategory[];
  sideKey: "away" | "home";
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {team.logoUrl ? (
          <ScheduleTeamLogo
            src={team.logoUrl}
            size={24}
            className="size-6"
          />
        ) : null}
        <h3 className="text-sm font-semibold tracking-tight">{team.nickname}</h3>
      </div>
      <ul className="flex flex-col gap-3">
        {leaders.map((leader) => {
          const side = leader[sideKey];
          return (
            <li key={`${sideKey}-${leader.category}`} className="flex flex-col gap-1.5">
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {leader.category}
              </p>
              <LeaderSide side={side} align="left" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type LeadersListProps = {
  leaders: GameLeaderCategory[];
  away: TeamMeta;
  home: TeamMeta;
};

export function LeadersList({ leaders, away, home }: LeadersListProps) {
  return (
    <>
      <div className="flex flex-col gap-6 md:hidden">
        <TeamLeadersStack team={away} leaders={leaders} sideKey="away" />
        <TeamLeadersStack team={home} leaders={leaders} sideKey="home" />
      </div>

      <ul className="hidden flex-col gap-4 md:flex">
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
    </>
  );
}
