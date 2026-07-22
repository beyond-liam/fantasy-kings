"use client";

import Link from "next/link";
import { AddTeamIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerIdentity } from "@/components/rankings/player-identity";
import { Button } from "@/components/ui/button";
import { TableShell } from "@/components/ui/table";
import type { WaiverTip } from "@/lib/leagues/game-centre/waivers";

type WaiverTipsProps = {
  tips: WaiverTip[];
  leagueSlug: string;
};

export function WaiverTips({ tips, leagueSlug }: WaiverTipsProps) {
  if (tips.length === 0) {
    return null;
  }

  return (
    <TableShell>
      <div className="flex h-10 items-center justify-between gap-3 border-b bg-muted px-4">
        <span className="text-xs font-medium uppercase">Pickups</span>
        <Button
          nativeButton={false}
          size="xs"
          variant="ghost"
          render={<Link href={`/league/${leagueSlug}/players?fa=1`} />}
        >
          <HugeiconsIcon
            icon={AddTeamIcon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          View players
        </Button>
      </div>
      <ul>
        {tips.map((tip) => (
          <li
            key={tip.playerId}
            className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0"
          >
            <PlayerIdentity
              fullName={tip.fullName}
              primaryPositionId={tip.primaryPositionId}
              nflTeam={tip.nflTeam}
              size="sm"
              playerId={tip.playerId}
              leagueSlug={leagueSlug}
            />
            <div className="shrink-0 text-right text-xs tabular-nums">
              <div className="font-medium">
                {tip.projectedPts.toFixed(1)} proj
              </div>
              {tip.targetSlot && tip.upgradeOver != null ? (
                <div className="text-muted-foreground">
                  +{tip.upgradeOver.toFixed(1)} at {tip.targetSlot}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </TableShell>
  );
}
