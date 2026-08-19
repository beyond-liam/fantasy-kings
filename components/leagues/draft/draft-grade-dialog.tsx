"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { PlayerProfileTrigger } from "@/components/rankings/player-identity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { markDraftGradeSeen } from "@/lib/actions/draft-grades";
import {
  draftGradeImageSrc,
  formatDraftPickLabel,
} from "@/lib/leagues/draft/grades";
import type { UnseenDraftGrade } from "@/lib/queries/draft-grades";
import { teamInitials } from "@/lib/leagues/standings";
import { cn } from "@/lib/utils";

type DraftGradeDialogProps = {
  leagueSlug: string;
  grade: UnseenDraftGrade;
  /** Skip persisting seen — for local UI preview only. */
  preview?: boolean;
};

function oddsLabel(playoffOdds: number) {
  if (playoffOdds >= 85) return "It's a lock";
  if (playoffOdds >= 65) return "Strong";
  if (playoffOdds >= 45) return "Toss-up";
  if (playoffOdds >= 25) return "Long shot";
  return "Uphill";
}

function ValueCard({
  title,
  player,
  tone,
  leagueSlug,
}: {
  title: string;
  player: NonNullable<UnseenDraftGrade["bestValue"]>;
  tone: "best" | "worst";
  leagueSlug: string;
}) {
  /** overall − ADP: positive = drafted later than ADP (steal). */
  const adpDelta = Math.round(player.overall - player.adp);
  const places = Math.abs(adpDelta);
  const isSteal = tone === "best";

  return (
    <PlayerProfileTrigger
      playerId={player.playerId}
      leagueSlug={leagueSlug}
      aria-label={`View ${player.fullName}`}
      className="flex flex-col overflow-hidden rounded-xl border bg-card"
    >
      <p className="px-3 pt-2.5 text-center text-xs font-medium text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-1 flex-col items-center gap-2 px-3 py-3">
        <PlayerAvatar
          fullName={player.fullName}
          sleeperId={player.sleeperId}
          primaryPositionId={player.primaryPositionId}
          nflTeam={player.nflTeam}
          size="lg"
        />
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {formatDraftPickLabel(player.round, player.pickInRound)}
          </p>
          {places > 0 ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
                isSteal ? "text-success" : "text-destructive",
              )}
            >
              <HugeiconsIcon
                icon={isSteal ? ArrowUp01Icon : ArrowDown01Icon}
                strokeWidth={2}
                className="size-3"
              />
              {isSteal
                ? `${places} after ADP`
                : `${places} before ADP`}
            </span>
          ) : null}
        </div>
      </div>
      <div
        className={cn(
          "px-3 py-2 text-center text-sm font-medium text-white",
          tone === "best" ? "bg-emerald-900" : "bg-rose-900",
        )}
      >
        <span className="line-clamp-1 underline-offset-2 group-hover/player-identity:underline group-focus-visible/player-identity:underline">
          {player.fullName}
        </span>
      </div>
    </PlayerProfileTrigger>
  );
}

export function DraftGradeDialog({
  leagueSlug,
  grade,
  preview = false,
}: DraftGradeDialogProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();

  const open = !dismissed;

  const dismiss = () => {
    if (preview) {
      setDismissed(true);
      return;
    }
    startTransition(async () => {
      await markDraftGradeSeen(leagueSlug, grade.id);
      setDismissed(true);
      router.refresh();
    });
  };

  const record = `${grade.projectedWins}–${grade.projectedLosses}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="gap-0 sm:max-w-md">
        <DialogHeader className="gap-3">
          <div className="flex items-center gap-3">
            <Avatar size="default">
              {grade.teamLogoUrl ? (
                <AvatarImage src={grade.teamLogoUrl} alt="" />
              ) : null}
              <AvatarFallback>{teamInitials(grade.teamName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <DialogTitle className="truncate text-base">
                {grade.teamName}
              </DialogTitle>
              <DialogDescription className="truncate">
                {grade.leagueName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 px-2 pb-2 pt-4">
          <Image
            src={draftGradeImageSrc(grade.letter)}
            alt={`Draft grade ${grade.letter}`}
            width={220}
            height={260}
            className="h-auto w-[min(100%,220px)]"
            priority
          />
          {grade.headline ? (
            <p className="text-sm font-medium text-muted-foreground">
              {grade.headline}
            </p>
          ) : null}
          <p className="text-4xl font-semibold tracking-tight tabular-nums text-balance">
            {record}
          </p>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Projected record
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 px-1 py-3">
          <div className="rounded-xl border border-emerald-600/40 bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Playoff chances</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {Math.round(grade.playoffOdds)}%
            </p>
            <span className="mt-2 inline-flex rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
              {oddsLabel(grade.playoffOdds)}
            </span>
          </div>
          <div className="rounded-xl border border-emerald-600/40 bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Championship</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {Math.round(grade.championshipOdds)}%
            </p>
            <span className="mt-2 inline-flex rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
              #{grade.leagueRank} of {grade.teamCount}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-1 pb-2">
          {grade.bestValue ? (
            <ValueCard
              title="Best value pick"
              player={grade.bestValue}
              tone="best"
              leagueSlug={leagueSlug}
            />
          ) : (
            <div className="rounded-xl border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              No ADP value pick
            </div>
          )}
          {grade.worstValue ? (
            <ValueCard
              title="Worst value pick"
              player={grade.worstValue}
              tone="worst"
              leagueSlug={leagueSlug}
            />
          ) : (
            <div className="rounded-xl border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              No ADP value pick
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
