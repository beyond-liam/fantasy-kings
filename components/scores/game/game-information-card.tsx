import {
  Building01Icon,
  Calendar01Icon,
  Location01Icon,
  ModernTvIcon,
  WhistleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MISSING_VALUE,
  type GameOfficial,
} from "@/lib/espn/game-summary";
import type { ScheduleGame } from "@/lib/espn/scoreboard";
import { formatKickoffDayShort, formatKickoffTime } from "@/lib/nfl/schedule-week";
import { cn } from "@/lib/utils";

type GameInformationCardProps = {
  game: Pick<ScheduleGame, "kickoff" | "venue" | "venueLocation" | "network">;
  attendance?: number | null;
  officials?: GameOfficial[] | null;
  className?: string;
};

function InfoRow({
  icon,
  children,
}: {
  icon: typeof Calendar01Icon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <HugeiconsIcon
        icon={icon}
        strokeWidth={2}
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function GameInformationCard({
  game,
  attendance = null,
  officials = null,
  className,
}: GameInformationCardProps) {
  const kickoff = new Date(game.kickoff);
  const network = game.network?.trim() || null;

  return (
    <Card size="sm" className={cn("gap-0 py-0", className)}>
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">Game Information</CardTitle>
      </CardHeader>
      <CardContent className="py-4">
        <div className="flex flex-col gap-3">
          <InfoRow icon={Calendar01Icon}>
            <p className="text-sm font-medium tabular-nums">
              {formatKickoffTime(kickoff)}, {formatKickoffDayShort(kickoff)}
            </p>
          </InfoRow>

          <div className="border-t pt-3">
            <InfoRow icon={Location01Icon}>
              <p className="text-sm font-medium">{game.venue}</p>
              {game.venueLocation ? (
                <p className="text-sm text-muted-foreground">
                  {game.venueLocation}
                </p>
              ) : null}
            </InfoRow>
          </div>

          {attendance != null ? (
            <div className="border-t pt-3">
              <InfoRow icon={Building01Icon}>
                <p className="text-sm font-medium tabular-nums">
                  Attendance: {attendance.toLocaleString("en-US")}
                </p>
              </InfoRow>
            </div>
          ) : null}

          <div className="border-t pt-3">
            <InfoRow icon={ModernTvIcon}>
              <p className="text-sm font-medium">Where to Watch</p>
              {network ? (
                <Badge variant="secondary" className="mt-1.5">
                  {network}
                </Badge>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {MISSING_VALUE}
                </p>
              )}
            </InfoRow>
          </div>

          {officials?.length ? (
            <div className="border-t pt-3">
              <InfoRow icon={WhistleIcon}>
                <p className="text-sm font-medium">Officiating Crew</p>
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {officials.map((official) => (
                    <li
                      key={`${official.role}-${official.name}`}
                      className="text-sm"
                    >
                      <span>{official.role}: </span>
                      <span className="text-muted-foreground">
                        {official.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </InfoRow>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
