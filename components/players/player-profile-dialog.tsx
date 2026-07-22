"use client";

import { useEffect, useState, useTransition } from "react";

import { TeamTableColumnHeader } from "@/components/team/team-table-column-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  contrastForeground,
  getNflTeamColors,
  getNflTeamDivision,
  getNflTeamStadiumUrl,
} from "@/lib/nfl/team-colors";
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

function formatPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatPts(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

function formatStat(value: number | null | undefined, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Number.isInteger(value) && decimals <= 1) return String(value);
  return value.toFixed(decimals);
}

/** Sleeper often stores height as total inches ("77") or already as 6'5\". */
function formatHeight(value: string | null | undefined) {
  if (!value?.trim()) return "—";
  const raw = value.trim();
  if (raw.includes("'") || raw.toLowerCase().includes("ft")) {
    return raw;
  }
  const inches = Number(raw);
  if (!Number.isFinite(inches) || inches <= 0) {
    return raw;
  }
  const feet = Math.floor(inches / 12);
  const rem = Math.round(inches % 12);
  return `${feet}'${rem}"`;
}

function formatWeight(value: string | null | undefined) {
  if (!value?.trim()) return "—";
  const raw = value.trim();
  if (/lb/i.test(raw)) return raw;
  return `${raw} lbs`;
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

function PlayerProfileHeader({ profile }: { profile: PlayerProfile }) {
  const team = getNflTeamColors(profile.nflTeam);
  const headerBg = team?.header ?? undefined;
  const fg = headerBg ? contrastForeground(headerBg) : undefined;
  const muted =
    fg === "#0a0a0a" ? "rgba(10, 10, 10, 0.65)" : "rgba(255, 255, 255, 0.72)";
  const injury = getInjuryIndicator(profile.injuryStatus);
  const bye = resolvePlayerByeWeek({
    byeWeek: profile.byeWeek,
    nflTeam: profile.nflTeam,
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

      <div className="relative z-10 flex items-start gap-4 px-5 py-5 sm:gap-5 sm:px-6 sm:py-6">
        <div className="relative z-10 shrink-0">
          <div className="size-36 overflow-hidden rounded-lg bg-black/20 outline outline-1 outline-black/10 sm:size-44 dark:outline-white/10">
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
          <div className="flex flex-col gap-0">
            <h2 className="min-w-0 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {profile.fullName}
            </h2>
            <p
              className="text-sm font-medium tracking-wide"
              style={{ color: muted }}
            >
              {positionLine}
            </p>
          </div>

          {isDef ? (
            <HeaderBioStat
              label="Conference"
              value={division ?? "—"}
              muted={muted}
            />
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              <HeaderBioStat
                label="Age"
                value={profile.age != null ? String(profile.age) : "—"}
                muted={muted}
              />
              <HeaderBioStat
                label="Height"
                value={formatHeight(profile.height)}
                muted={muted}
              />
              <HeaderBioStat
                label="Weight"
                value={formatWeight(profile.weight)}
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

          <div className="flex flex-col gap-1">
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
                  {formatPct(profile.ownedPct)}
                </span>{" "}
                <span style={{ color: muted }}>Rostered</span>
              </span>
              <span>
                <span className="font-semibold">
                  {formatPct(profile.startPct)}
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

function ProfileBody({ profile }: { profile: PlayerProfile }) {
  const useActualStats = hasActualSeasonStats(profile);
  const seasonBlock = useActualStats
    ? profile.seasonStats
    : profile.seasonProjection;
  const seasonColumns = profile.gameLogColumns.filter(
    (column) => column.key !== "adp",
  );

  return (
    <div>
      <PlayerProfileHeader profile={profile} />

      <div className="flex flex-col gap-6 p-5 sm:p-6">
        {profile.leagueSlug ? (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground">Owned by </span>
            {profile.ownership?.fantasyTeamName
              ? profile.ownership.fantasyTeamName
              : "Free agent"}
          </p>
        ) : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {useActualStats ? "Season stats" : "Season projection"}
          </h3>
          {seasonBlock ? (
            <TableShell>
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
            <p className="text-sm text-muted-foreground">
              {useActualStats
                ? `No season stats for ${profile.season} yet.`
                : "No season projection available yet."}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Game log</h3>
          {profile.gameLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No schedule available for {profile.season} yet.
            </p>
          ) : (
            <TableShell>
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <TeamTableColumnHeader
                          title="Wk"
                          tooltip="NFL week"
                        />
                      </TableHead>
                      <TableHead>
                        <TeamTableColumnHeader
                          title="Opp"
                          tooltip="Opponent"
                        />
                      </TableHead>
                      {profile.gameLogColumns.slice(0, 8).map((column) => (
                        <TableHead key={column.key} className="tabular-nums">
                          <TeamTableColumnHeader
                            title={column.header}
                            tooltip={column.tooltip}
                          />
                        </TableHead>
                      ))}
                      <TableHead className="tabular-nums">
                        <TeamTableColumnHeader
                          title="FPts"
                          tooltip="Fantasy points"
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profile.gameLog.map((row) => (
                      <TableRow key={row.week}>
                        <TableCell className="tabular-nums">
                          {row.week}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {row.opponent ?? "—"}
                        </TableCell>
                        {profile.gameLogColumns.slice(0, 8).map((column) => (
                          <TableCell
                            key={column.key}
                            className="tabular-nums text-muted-foreground"
                          >
                            {formatStat(
                              row.stats[column.key] ?? null,
                              column.decimals ?? 1,
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="tabular-nums font-medium">
                          {formatPts(row.fantasyPts)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </TableShell>
          )}
        </section>

        {profile.leagueSlug ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Transaction history</h3>
            {profile.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No league transactions for this player yet.
              </p>
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
          "max-h-[min(90dvh,52rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl",
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
          <p className="py-8 text-center text-sm text-muted-foreground">
            {error}
          </p>
        ) : showProfile ? (
          <ProfileBody profile={profile} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
