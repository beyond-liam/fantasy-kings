"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PlayerActionButton } from "@/components/rankings/player-action-button";
import { PlayerWatchlistButton } from "@/components/players/player-watchlist-button";
import { resolvePlayerByeWeek } from "@/lib/nfl/bye-weeks";
import { getNflTeamDivision } from "@/lib/nfl/team-colors";
import {
  formatOwnershipPct,
  formatPlayerHeight,
  formatPlayerWeight,
} from "@/lib/players/bio-format";
import { getInjuryIndicator } from "@/lib/players/injury";
import {
  formatProjectionStat,
  getProjectionHighlightStats,
  projectionAccentSurfaceClass,
  projectionAccentTextClass,
} from "@/lib/players/projection-highlights";
import type { PlayerProfile } from "@/lib/queries/player-profile";
import {
  getPlayerInitials,
  getSleeperPlayerAvatarUrl,
  getSleeperTeamLogoUrl,
} from "@/lib/sleeper/avatars";
import { cn } from "@/lib/utils";

type PlayerIdentityCardProps = {
  profile: PlayerProfile;
  className?: string;
};

function BioStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="truncate text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function PlayerIdentityCard({
  profile,
  className,
}: PlayerIdentityCardProps) {
  const injury = getInjuryIndicator(profile.injuryStatus);
  const bye = resolvePlayerByeWeek({
    byeWeek: profile.byeWeek,
    nflTeam: profile.nflTeam,
    seasonYear: Number(profile.season) || undefined,
  });
  const isDef = profile.primaryPositionId === "DEF";
  const division = isDef ? getNflTeamDivision(profile.nflTeam) : null;
  const headshot =
    isDef && profile.nflTeam
      ? getSleeperTeamLogoUrl(profile.nflTeam)
      : profile.sleeperId
        ? getSleeperPlayerAvatarUrl(profile.sleeperId)
        : null;
  const teamLogo =
    !isDef && profile.nflTeam
      ? getSleeperTeamLogoUrl(profile.nflTeam)
      : null;

  const positionMeta = [
    profile.primaryPositionId,
    profile.nflTeam,
    bye != null ? `Bye ${bye}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const highlightStats = getProjectionHighlightStats(profile);
  const slug = profile.leagueSlug;
  const ownership = profile.ownership;
  const showLeagueActions = Boolean(slug && ownership);

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      {/* Reserves the top half of the avatar above the card */}
      <div className="h-16 sm:h-20" aria-hidden />

      {/* Plain sized frame — avoids Avatar `data-[size]` beating `size-*` */}
      <div className="absolute top-0 left-1/2 z-30 -translate-x-1/2">
        <div className="relative size-32 sm:size-40">
          <div
            className={cn(
              "size-full overflow-hidden rounded-full bg-muted shadow-lg ring-4 ring-foreground/12",
              isDef && "bg-background",
            )}
          >
            {headshot ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote CDN headshot
              <img
                src={headshot}
                alt=""
                className={cn(
                  "size-full object-cover",
                  isDef && "object-contain p-3",
                )}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl font-semibold text-muted-foreground sm:text-3xl">
                {getPlayerInitials(profile.fullName)}
              </div>
            )}
          </div>
          {teamLogo ? (
            <span className="absolute right-0 bottom-0 z-10 flex size-10 items-center justify-center sm:size-12">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote CDN logo */}
              <img
                src={teamLogo}
                alt=""
                className="size-full object-contain"
              />
            </span>
          ) : null}
        </div>
      </div>

      <Card
        size="sm"
        className="relative z-10 overflow-visible bg-background pt-16 shadow-lg ring-foreground/12 sm:pt-20"
      >
        <div className="mt-4 flex flex-col items-center gap-3 px-(--card-spacing) text-center">
          <div className="flex min-w-0 flex-col items-center gap-1">
            <h1 className="w-full text-xl font-semibold tracking-tight text-balance sm:text-2xl">
              {profile.fullName}
            </h1>
            <p className="text-sm text-muted-foreground">{positionMeta}</p>
            {injury ? (
              <Badge
                variant={
                  injury.tone === "questionable" ? "warning" : "destructive"
                }
              >
                {injury.label}
              </Badge>
            ) : null}
          </div>

          {showLeagueActions && slug && ownership ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <PlayerWatchlistButton
                key={profile.id}
                playerId={profile.id}
                leagueSlug={slug}
                initialWatched={profile.isWatched}
              />
              <PlayerActionButton
                appearance="button"
                leagueSlug={slug}
                player={{
                  id: profile.id,
                  fullName: profile.fullName,
                  fantasyTeamId: ownership.fantasyTeamId,
                  fantasyTeamSlug: ownership.fantasyTeamSlug,
                  isOwnedByCurrentUser: ownership.isOwnedByCurrentUser,
                  onWaivers: ownership.onWaivers,
                  acquisitionKind: ownership.acquisitionKind,
                  hasPendingClaim: ownership.hasPendingClaim,
                }}
              />
            </div>
          ) : null}

          {isDef ? (
            <BioStat label="Conference" value={division ?? "—"} />
          ) : (
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
              <BioStat
                label="Age"
                value={profile.age != null ? String(profile.age) : "—"}
              />
              <BioStat
                label="Height"
                value={formatPlayerHeight(profile.height)}
              />
              <BioStat
                label="Weight"
                value={formatPlayerWeight(profile.weight)}
              />
              <BioStat
                label="Exp"
                value={
                  profile.yearsExp != null ? String(profile.yearsExp) : "—"
                }
              />
            </div>
          )}

          <div className="flex w-full flex-col items-center gap-1">
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Player rankings
            </span>
            <div className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1 text-sm tabular-nums">
              <span>
                <span className="font-semibold">
                  {profile.positionRank != null
                    ? `#${profile.positionRank}`
                    : "—"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {profile.primaryPositionId}
                </span>
              </span>
              <span>
                <span className="font-semibold">
                  {formatOwnershipPct(profile.ownedPct)}
                </span>{" "}
                <span className="text-muted-foreground">Rostered</span>
              </span>
              <span>
                <span className="font-semibold">
                  {formatOwnershipPct(profile.startPct)}
                </span>{" "}
                <span className="text-muted-foreground">Started</span>
              </span>
            </div>
          </div>
        </div>

        <CardContent className="flex flex-col gap-3">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {profile.season} projection
          </p>

          {highlightStats.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {highlightStats.map((stat) => (
                <div
                  key={stat.key}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg bg-muted/40 px-2.5 py-2 ring-1 ring-foreground/8",
                    projectionAccentSurfaceClass(stat.accentTone),
                  )}
                >
                  <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    {stat.label}
                  </span>
                  <span
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      projectionAccentTextClass(stat.accentTone),
                    )}
                  >
                    {formatProjectionStat(stat.value, stat.decimals ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Projections appear when player data is available.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
