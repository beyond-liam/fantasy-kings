"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Contact01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerActionButton } from "@/components/rankings/player-action-button";
import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { PlayerGameLogTable } from "@/components/players/player-game-log-table";
import { PlayerWatchlistButton } from "@/components/players/player-watchlist-button";
import { TeamTableColumnHeader } from "@/components/team/team-table-column-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  TABLE_SHELL_CLASSNAME,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { loadPlayerProfile } from "@/lib/actions/player-profile";
import { resolvePlayerByeWeek } from "@/lib/nfl/bye-weeks";
import { playerProfileHref } from "@/lib/players/profile-path";
import {
  contrastForeground,
  getNflTeamColors,
  getNflTeamDivision,
  getNflTeamStadiumUrl,
} from "@/lib/nfl/team-colors";
import {
  formatOwnershipPct,
  formatPlayerHeight,
  formatPlayerWeight,
} from "@/lib/players/bio-format";
import { getInjuryIndicator } from "@/lib/players/injury";
import type { PlayerProfile } from "@/lib/queries/player-profile";
import {
  getPlayerInitials,
  getSleeperPlayerAvatarUrl,
  getSleeperTeamLogoUrl,
} from "@/lib/sleeper/avatars";

type PlayerProfileDialogProps = {
  playerId: string | null;
  leagueSlug?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatPts(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

function formatStat(value: number | null | undefined, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Number.isInteger(value) && decimals <= 1) return String(value);
  return value.toFixed(decimals);
}

function HeaderBioStat({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span
        className="text-[10px] font-medium tracking-wide uppercase"
        style={{ color: muted }}
      >
        {label}
      </span>
      <span className="truncate text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function PlayerProfileHeader({
  profile,
  headingLevel = "h2",
}: {
  profile: PlayerProfile;
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;
  const team = getNflTeamColors(profile.nflTeam);
  const headerBg = team?.header ?? undefined;
  const fg = headerBg ? contrastForeground(headerBg) : undefined;
  const muted =
    fg === "#0a0a0a" ? "rgba(10, 10, 10, 0.65)" : "rgba(255, 255, 255, 0.72)";
  const injury = getInjuryIndicator(profile.injuryStatus);
  const bye = resolvePlayerByeWeek({
    byeWeek: profile.byeWeek,
    nflTeam: profile.nflTeam,
    seasonYear: Number(profile.season) || undefined,
  });
  const isDef = profile.primaryPositionId === "DEF";
  const division = isDef ? getNflTeamDivision(profile.nflTeam) : null;
  const stadiumUrl = getNflTeamStadiumUrl(profile.nflTeam);

  const headshot =
    isDef && profile.nflTeam
      ? getSleeperTeamLogoUrl(profile.nflTeam)
      : profile.sleeperId
        ? getSleeperPlayerAvatarUrl(profile.sleeperId)
        : null;

  const positionLine = [
    profile.primaryPositionId,
    bye != null ? `(${bye})` : null,
    injury ? `- ${injury.label}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header
      className={cn(
        "relative overflow-hidden text-white",
        !headerBg && !stadiumUrl && "bg-muted text-foreground",
      )}
      style={fg ? { color: fg } : undefined}
    >
      {stadiumUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local public asset
        <img
          src={stadiumUrl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full object-cover select-none"
        />
      ) : null}
      <div
        className={cn(
          "absolute inset-0",
          !headerBg && stadiumUrl && "bg-black/55",
        )}
        style={
          headerBg
            ? {
                backgroundColor: headerBg,
                opacity: stadiumUrl ? 0.9 : 1,
              }
            : undefined
        }
      />

      <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:gap-5 sm:px-6 sm:py-6">
        {/* Desktop — large rectangular headshot */}
        <div className="relative z-10 hidden shrink-0 sm:block">
          <div className="size-44 overflow-hidden rounded-lg bg-black/20 outline outline-1 outline-black/10 dark:outline-white/10">
            {headshot ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote CDN headshot
              <img
                src={headshot}
                alt=""
                className={cn(
                  "size-full object-cover",
                  isDef
                    ? "object-contain p-3"
                    : "scale-125 object-[center_20%]",
                )}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl font-semibold">
                {getPlayerInitials(profile.fullName)}
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-3 pr-8">
          {/* Identity: circular avatar + name/pos on mobile; name/pos only on desktop */}
          <div className="flex items-center gap-3">
            <PlayerAvatar
              fullName={profile.fullName}
              sleeperId={profile.sleeperId}
              primaryPositionId={profile.primaryPositionId}
              nflTeam={profile.nflTeam}
              size="lg"
              className="size-12 sm:hidden"
            />
            <div className="flex min-w-0 flex-1 flex-col leading-none">
              <Heading className="min-w-0 text-[17px] leading-tight font-semibold tracking-tight text-balance sm:text-3xl sm:leading-snug">
                {profile.fullName}
              </Heading>
              <p
                className="text-sm leading-tight font-medium tracking-wide"
                style={{ color: muted }}
              >
                {positionLine}
              </p>
            </div>
          </div>

          {isDef ? (
            <HeaderBioStat
              label="Conference"
              value={division ?? "—"}
              muted={muted}
            />
          ) : (
            <div className="grid w-full grid-cols-3 gap-3 sm:grid-cols-5">
              <HeaderBioStat
                label="Age"
                value={profile.age != null ? String(profile.age) : "—"}
                muted={muted}
              />
              <HeaderBioStat
                label="Height"
                value={formatPlayerHeight(profile.height)}
                muted={muted}
              />
              <HeaderBioStat
                label="Weight"
                value={formatPlayerWeight(profile.weight)}
                muted={muted}
              />
              <HeaderBioStat
                label="Exp"
                value={
                  profile.yearsExp != null ? String(profile.yearsExp) : "—"
                }
                muted={muted}
              />
              <HeaderBioStat
                label="College"
                value={profile.college?.trim() || "—"}
                muted={muted}
              />
            </div>
          )}

          <div className="flex w-full flex-col gap-1">
            <span
              className="text-[10px] font-medium tracking-wide uppercase"
              style={{ color: muted }}
            >
              Player rankings
            </span>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm tabular-nums">
              <span>
                <span className="font-semibold">
                  {profile.positionRank != null
                    ? `#${profile.positionRank}`
                    : "—"}
                </span>{" "}
                <span style={{ color: muted }}>
                  {profile.primaryPositionId}
                </span>
              </span>
              <span>
                <span className="font-semibold">
                  {formatOwnershipPct(profile.ownedPct)}
                </span>{" "}
                <span style={{ color: muted }}>Rostered</span>
              </span>
              <span>
                <span className="font-semibold">
                  {formatOwnershipPct(profile.startPct)}
                </span>{" "}
                <span style={{ color: muted }}>Started</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function hasActualSeasonStats(profile: PlayerProfile) {
  if (profile.gameLog.some((row) => row.fantasyPts != null)) {
    return true;
  }
  const gp = profile.seasonStats?.stats.gp;
  return typeof gp === "number" && Number.isFinite(gp) && gp > 0;
}

export function PlayerProfileContent({
  profile,
  headingLevel = "h2",
  showHeader = true,
}: {
  profile: PlayerProfile;
  headingLevel?: "h1" | "h2";
  /** When false, skips the stadium/color header (used by the full player page). */
  showHeader?: boolean;
}) {
  const useActualStats = hasActualSeasonStats(profile);
  const seasonBlock = useActualStats
    ? profile.seasonStats
    : profile.seasonProjection;
  const seasonColumns = profile.gameLogColumns.filter(
    (column) => column.key !== "adp",
  );

  return (
    <div className="min-w-0">
      {showHeader ? (
        <PlayerProfileHeader profile={profile} headingLevel={headingLevel} />
      ) : null}

      <div className="flex min-w-0 flex-col gap-6 p-5 sm:p-6">
        {profile.leagueSlug ? (
          <p className="text-sm text-muted-foreground">
            {profile.ownership?.fantasyTeamName ? (
              <>
                <span className="text-foreground">Owned by </span>
                {profile.ownership.fantasyTeamName}
              </>
            ) : (
              <span className="text-foreground">Free agent</span>
            )}
          </p>
        ) : null}

        <section className="flex min-w-0 flex-col gap-2">
          <h3 className="text-sm font-medium">
            {useActualStats
              ? `Season stats · ${profile.season}`
              : `Season projection · ${profile.season}`}
          </h3>
          {seasonBlock ? (
            <TableShell className="min-w-0">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="tabular-nums">
                        <TeamTableColumnHeader
                          title="FPts"
                          tooltip="Fantasy points"
                        />
                      </TableHead>
                      {seasonColumns.map((column) => (
                        <TableHead key={column.key} className="tabular-nums">
                          <TeamTableColumnHeader
                            title={column.header}
                            tooltip={column.tooltip}
                          />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="tabular-nums font-medium">
                        {formatPts(seasonBlock.fantasyPts)}
                      </TableCell>
                      {seasonColumns.map((column) => (
                        <TableCell
                          key={column.key}
                          className="tabular-nums text-muted-foreground"
                        >
                          {formatStat(
                            seasonBlock.stats[column.key] ?? null,
                            column.decimals ?? 1,
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </TooltipProvider>
            </TableShell>
          ) : (
            <Empty className="border-none" size="sm">
              <EmptyHeader>
                <EmptyTitle>
                  {useActualStats ? "No season stats yet" : "No projection yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {useActualStats
                    ? `Season stats for ${profile.season} will appear after games land.`
                    : "Projections appear when player data is available."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <h3 className="text-sm font-medium">Game log</h3>
          <PlayerGameLogTable profile={profile} />
        </section>

        {profile.leagueSlug ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Transaction history</h3>
            {profile.activity.length === 0 ? (
              <Empty className="border-none" size="sm">
                <EmptyHeader>
                  <EmptyTitle>No transactions yet</EmptyTitle>
                  <EmptyDescription>
                    League moves involving this player will show here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className={cn(TABLE_SHELL_CLASSNAME, "divide-y")}>
                {profile.activity.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col gap-0.5 px-3 py-2"
                  >
                    <p className="text-sm text-pretty">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground"> · </span>
                      {item.summary}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "UTC",
                      }).format(new Date(item.createdAt))}{" "}
                      UTC
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function PlayerProfileDialogFooter({
  profile,
  leagueSlug,
}: {
  profile: PlayerProfile;
  leagueSlug?: string | null;
}) {
  const slug = leagueSlug?.trim() || profile.leagueSlug;
  const ownership = profile.ownership;
  const showLeagueActions = Boolean(slug && ownership);

  return (
    <DialogFooter
      className={cn(
        // Keep sticky from DialogFooter — do not set `relative` (overrides sticky).
        "z-40 mb-0 flex-row items-center gap-2 border-t bg-dialog p-4 sm:p-6",
        showLeagueActions ? "justify-between" : "justify-end",
      )}
    >
      {showLeagueActions && slug && ownership ? (
        <div className="flex shrink-0 items-center gap-2">
          <PlayerWatchlistButton
            key={profile.id}
            playerId={profile.id}
            leagueSlug={slug}
            initialWatched={profile.isWatched}
          />
          <PlayerActionButton
            appearance="button"
            leagueSlug={slug}
            disabled={!ownership.actionsEnabled}
            disabledReason={
              ownership.actionsLockReason ?? "Free agency is closed"
            }
            tradesEnabled={ownership.tradesEnabled}
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

      <Button
        nativeButton={false}
        className={cn(
          "min-w-0",
          showLeagueActions ? "flex-1 sm:flex-initial" : "w-full sm:w-auto",
        )}
        render={
          <Link
            href={playerProfileHref({
              playerId: profile.publicId,
              leagueSlug: slug,
              season: profile.season,
            })}
          />
        }
      >
        <HugeiconsIcon
          icon={Contact01Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        View Player Profile
      </Button>
    </DialogFooter>
  );
}

export function PlayerProfileDialog({
  playerId,
  leagueSlug,
  open,
  onOpenChange,
}: PlayerProfileDialogProps) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const activePlayerId = open ? playerId : null;
  const showProfile =
    profile != null && activePlayerId != null && profile.id === activePlayerId;

  useEffect(() => {
    if (!activePlayerId) {
      return;
    }

    let cancelled = false;
    startTransition(async () => {
      const result = await loadPlayerProfile({
        playerId: activePlayerId,
        leagueSlug,
      });
      if (cancelled) {
        return;
      }
      if (!result.success) {
        setProfile(null);
        setError(result.error);
        return;
      }
      setError(null);
      setProfile(result.profile);
    });

    return () => {
      cancelled = true;
    };
  }, [activePlayerId, leagueSlug]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(90dvh,52rem)] min-w-0 gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-3xl",
          showProfile &&
            "[&_[data-slot=dialog-close]]:z-50 [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/15 [&_[data-slot=dialog-close]]:hover:text-white",
        )}
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Player profile</DialogTitle>
          <DialogDescription>Detailed player statistics</DialogDescription>
        </DialogHeader>

        {pending && !showProfile ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="size-6" />
          </div>
        ) : error && !showProfile ? (
          <Empty className="border-none" size="sm">
            <EmptyHeader>
              <EmptyTitle>Could not load profile</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : showProfile ? (
          <>
            <PlayerProfileContent profile={profile} />
            <PlayerProfileDialogFooter
              profile={profile}
              leagueSlug={leagueSlug}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
