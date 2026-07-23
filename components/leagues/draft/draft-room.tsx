"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Home01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  DraftClockCard,
  DraftClockSeconds,
} from "@/components/draft/draft-clock-card";
import { DraftBoard } from "@/components/leagues/draft/draft-board";
import {
  DraftClockToggle,
  DraftRevertControl,
} from "@/components/leagues/draft/draft-controls";
import {
  DRAFT_PICKS_EVENT,
  type DraftPicksPollResponse,
} from "@/components/leagues/draft/draft-pick-notifier";
import { DraftPlayerPool } from "@/components/leagues/draft/draft-player-pool";
import { DraftQueuePanel } from "@/components/leagues/draft/draft-queue-panel";
import { DraftQueueProvider } from "@/components/leagues/draft/draft-queue-provider";
import { DraftRosterTab } from "@/components/leagues/draft/draft-roster-tab";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { autoDraftCurrentPick, tryAutoStartDraft } from "@/lib/actions/draft";
import { formatDraftScheduledAt } from "@/lib/leagues/draft-status";
import type { DraftScheduleSlot } from "@/lib/leagues/draft/board";
import type { DraftPickRow, DraftQueueRow } from "@/lib/queries/draft";
import type { RankedPlayerRow } from "@/lib/queries/players";
import { cn } from "@/lib/utils";

type DraftRoomProps = {
  slug: string;
  isCommissioner: boolean;
  myTeamId: string | null;
  status: "scheduled" | "live" | "paused" | "complete" | null;
  currentPickIndex: number;
  onTheClock: DraftScheduleSlot | null;
  startHint: string | null;
  schedule: DraftScheduleSlot[];
  picks: DraftPickRow[];
  teams: Array<{
    id: string;
    name: string;
    draftSlot: number;
    logoUrl?: string | null;
    userId?: string | null;
    autoPickEnabled?: boolean;
  }>;
  rounds: number;
  poolPlayers: RankedPlayerRow[];
  nflTeams: string[];
  queuedItems: DraftQueueRow[];
  draftedPlayerIds: string[];
  myDraftedPlayers: RankedPlayerRow[];
  pickByPlayerId: Record<string, number>;
  draftType: "live" | "email";
  pickTimeLimitSeconds: number;
  pickTimeLimitEnabled: boolean;
  autoPickEnabled: boolean;
  onTheClockTeamAutoPick: boolean;
  /** ISO scheduled start from league settings. */
  draftStartAt: string | null;
  /** ISO absolute deadline for the current pick clock. */
  turnExpiresAt: string | null;
  /** Frozen remaining seconds while paused. */
  pausedSecondsRemaining: number | null;
};

function playDraftSound(src: string) {
  try {
    const audio = new Audio(src);
    void audio.play();
  } catch {
    // Ignore autoplay / missing file failures.
  }
}

function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function computeSecondsLeft(input: {
  status: DraftRoomProps["status"];
  clockEnabled: boolean;
  turnExpiresAt: string | null;
  pausedSecondsRemaining: number | null;
  nowMs: number;
}): number | null {
  if (!input.clockEnabled) {
    return null;
  }
  if (input.status === "paused") {
    return input.pausedSecondsRemaining;
  }
  if (input.status !== "live" || !input.turnExpiresAt) {
    return null;
  }
  const expiresMs = new Date(input.turnExpiresAt).getTime();
  if (Number.isNaN(expiresMs)) {
    return null;
  }
  return Math.max(0, Math.ceil((expiresMs - input.nowMs) / 1000));
}

export function DraftRoom({
  slug,
  isCommissioner,
  myTeamId,
  status,
  currentPickIndex,
  onTheClock,
  startHint,
  schedule,
  picks,
  teams,
  rounds,
  poolPlayers,
  nflTeams,
  queuedItems,
  draftedPlayerIds,
  myDraftedPlayers,
  pickByPlayerId,
  draftType,
  pickTimeLimitSeconds,
  pickTimeLimitEnabled,
  autoPickEnabled,
  onTheClockTeamAutoPick,
  draftStartAt,
  turnExpiresAt,
  pausedSecondsRemaining,
}: DraftRoomProps) {
  const router = useRouter();
  const [tab, setTab] = useState("board");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [optimisticStatus, setOptimisticStatus] = useState(status);
  const [prevStatus, setPrevStatus] = useState(status);
  const autopickRef = useRef(false);
  const lastTurnCueRef = useRef<number | null>(null);

  if (status !== prevStatus) {
    setPrevStatus(status);
    setOptimisticStatus(status);
  }

  const effectiveStatus = optimisticStatus;
  const draftLive = effectiveStatus === "live";
  const draftComplete = effectiveStatus === "complete";
  const isMyTurn = Boolean(
    draftLive && onTheClock && myTeamId && onTheClock.teamId === myTeamId,
  );

  const clockEnabled =
    pickTimeLimitSeconds > 0 &&
    (draftType === "live" || pickTimeLimitEnabled);

  const secondsLeft = computeSecondsLeft({
    status: effectiveStatus,
    clockEnabled,
    turnExpiresAt,
    pausedSecondsRemaining,
    nowMs,
  });

  const onClockTeam = onTheClock
    ? (teams.find((team) => team.id === onTheClock.teamId) ?? null)
    : null;
  const onClockIsOpenSlot = Boolean(onClockTeam && onClockTeam.userId == null);
  const autopickAllowed =
    autoPickEnabled ||
    onTheClockTeamAutoPick ||
    onClockIsOpenSlot ||
    Boolean(onClockTeam?.autoPickEnabled);

  const queuedPlayerIds = useMemo(
    () => queuedItems.map((item) => item.playerId),
    [queuedItems],
  );

  const picksUntilUser = useMemo(() => {
    if (
      !myTeamId ||
      (effectiveStatus !== "live" && effectiveStatus !== "paused")
    ) {
      return null;
    }
    for (let index = currentPickIndex; index < schedule.length; index++) {
      if (schedule[index]?.teamId === myTeamId) {
        return index - currentPickIndex;
      }
    }
    return null;
  }, [currentPickIndex, myTeamId, schedule, effectiveStatus]);

  useEffect(() => {
    let debounceId = 0;

    const onDraftPicks = (event: Event) => {
      const detail = (event as CustomEvent<DraftPicksPollResponse>).detail;
      if (!detail) {
        return;
      }
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        router.refresh();
      }, 500);
    };

    window.addEventListener(DRAFT_PICKS_EVENT, onDraftPicks);
    return () => {
      window.clearTimeout(debounceId);
      window.removeEventListener(DRAFT_PICKS_EVENT, onDraftPicks);
    };
  }, [router]);

  // Tick the pick clock while live.
  useEffect(() => {
    if (!clockEnabled || effectiveStatus !== "live") {
      return;
    }
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [clockEnabled, effectiveStatus, turnExpiresAt, currentPickIndex]);

  // Cue sound when it becomes your turn.
  useEffect(() => {
    if (!draftLive || !isMyTurn || !onTheClock) {
      return;
    }
    if (lastTurnCueRef.current === onTheClock.overall) {
      return;
    }
    lastTurnCueRef.current = onTheClock.overall;
    playDraftSound("/sound-youre-up.mp3");
  }, [draftLive, isMyTurn, onTheClock]);

  // Open / unclaimed slots autopick promptly when there is no pick clock.
  useEffect(() => {
    if (!draftLive || !onClockIsOpenSlot || clockEnabled) {
      return;
    }
    if (autopickRef.current) {
      return;
    }
    autopickRef.current = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        const result = await autoDraftCurrentPick(slug);
        if (result.success) {
          router.refresh();
          return;
        }
        autopickRef.current = false;
      })();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    draftLive,
    onClockIsOpenSlot,
    clockEnabled,
    slug,
    router,
    currentPickIndex,
    onTheClock?.overall,
  ]);

  // Autopick once when the clock hits zero.
  useEffect(() => {
    if (!draftLive || !clockEnabled || !autopickAllowed) {
      autopickRef.current = false;
      return;
    }
    if (secondsLeft == null || secondsLeft > 0) {
      if (secondsLeft != null && secondsLeft > 0) {
        autopickRef.current = false;
      }
      return;
    }
    if (autopickRef.current) {
      return;
    }
    autopickRef.current = true;
    void (async () => {
      const result = await autoDraftCurrentPick(slug);
      if (result.success) {
        router.refresh();
        return;
      }
      // Allow a retry after refresh if the pick is still open.
      autopickRef.current = false;
    })();
  }, [
    autopickAllowed,
    clockEnabled,
    draftLive,
    router,
    secondsLeft,
    slug,
    currentPickIndex,
  ]);

  // Auto-start when the scheduled draft time is reached (also covered by cron).
  const waitingToStart =
    effectiveStatus === null || effectiveStatus === "scheduled";
  const autoStartRef = useRef(false);

  useEffect(() => {
    if (!draftStartAt || !waitingToStart) {
      autoStartRef.current = false;
      return;
    }

    const startMs = new Date(draftStartAt).getTime();
    if (Number.isNaN(startMs)) {
      return;
    }

    const trigger = async () => {
      if (autoStartRef.current) {
        return;
      }
      autoStartRef.current = true;
      const result = await tryAutoStartDraft(slug);
      if (result.success && result.started) {
        setOptimisticStatus("live");
        router.refresh();
        return;
      }
      autoStartRef.current = false;
    };

    const delay = Math.max(0, startMs - Date.now());
    if (delay === 0) {
      void trigger();
      return;
    }

    const timer = window.setTimeout(() => {
      void trigger();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [draftStartAt, waitingToStart, slug, router]);

  // Tick while waiting so the scheduled countdown stays fresh.
  useEffect(() => {
    if (!waitingToStart || !draftStartAt) {
      return;
    }
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [waitingToStart, draftStartAt]);

  const clockCardTitle =
    effectiveStatus === "complete"
      ? "Draft complete"
      : waitingToStart
        ? "Waiting to start"
        : effectiveStatus === "paused"
          ? "Draft paused"
          : isMyTurn
            ? "On the clock"
            : "Up next";

  const scheduledStartMs = draftStartAt
    ? new Date(draftStartAt).getTime()
    : Number.NaN;
  const secondsUntilStart =
    waitingToStart && !Number.isNaN(scheduledStartMs)
      ? Math.max(0, Math.ceil((scheduledStartMs - nowMs) / 1000))
      : null;

  const waitingMessage = (() => {
    if (!draftStartAt || Number.isNaN(scheduledStartMs)) {
      return isCommissioner
        ? (startHint ?? "You can start the draft anytime.")
        : "Waiting for the commissioner to start.";
    }
    const label = formatDraftScheduledAt(new Date(draftStartAt));
    if (secondsUntilStart != null && secondsUntilStart > 0) {
      return `Starts in ${formatCountdown(secondsUntilStart)} · ${label}`;
    }
    return isCommissioner
      ? (startHint ?? "Starting…")
      : `Scheduled for ${label}`;
  })();

  return (
    <DraftQueueProvider slug={slug} initialQueuedIds={queuedPlayerIds}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              League Draft
            </h1>
            <DraftRevertControl
              slug={slug}
              isCommissioner={isCommissioner}
              status={effectiveStatus}
              canRevert={currentPickIndex > 0}
              onStatusOptimistic={setOptimisticStatus}
            />
            {effectiveStatus === "complete" ? (
              <Alert variant="success" className="max-w-lg">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
                <AlertTitle>Season is live</AlertTitle>
                <AlertDescription className="flex flex-col gap-3">
                  <span>
                    The draft is complete. Set your lineup and check this
                    week&apos;s matchups.
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/league/${slug}/team`} />}
                    >
                      <HugeiconsIcon
                        icon={UserIcon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      My Team
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/league/${slug}/matchups`} />}
                    >
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      Matchups
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      nativeButton={false}
                      render={<Link href={`/league/${slug}`} />}
                    >
                      <HugeiconsIcon
                        icon={Home01Icon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      League home
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DraftClockCard
            title={clockCardTitle}
            showStopwatch={effectiveStatus !== "complete"}
            headerAction={
              <DraftClockToggle
                slug={slug}
                isCommissioner={isCommissioner}
                status={effectiveStatus}
                startHint={startHint}
                onStatusOptimistic={setOptimisticStatus}
              />
            }
          >
            {effectiveStatus === "complete" ? (
              <p className="text-sm text-muted-foreground">
                All {schedule.length} picks are in. The season is now active.
              </p>
            ) : waitingToStart ? (
              <p className="text-sm text-muted-foreground">{waitingMessage}</p>
            ) : isMyTurn && onTheClock ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  You · Pick #{onTheClock.overall}
                </p>
                {secondsLeft != null ? (
                  <DraftClockSeconds seconds={secondsLeft} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Round {onTheClock.round} · Pick {onTheClock.overall}
                  </p>
                )}
              </div>
            ) : onTheClock && picksUntilUser != null && picksUntilUser > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">
                  {onTheClock.teamName}
                  {onClockIsOpenSlot ? " (open)" : ""} · Pick #
                  {onTheClock.overall}
                </p>
                {onClockIsOpenSlot || onClockTeam?.autoPickEnabled ? (
                  <p className="text-xs text-muted-foreground">
                    Autopick on for this team
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground">You&apos;re up in</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {picksUntilUser}{" "}
                  <span className="text-base font-medium text-muted-foreground">
                    {picksUntilUser === 1 ? "pick" : "picks"}
                  </span>
                </p>
                {secondsLeft != null ? (
                  <p
                    className={cn(
                      "text-sm tabular-nums text-muted-foreground",
                      secondsLeft === 0 && "text-destructive",
                    )}
                  >
                    Clock: {secondsLeft}s
                  </p>
                ) : null}
              </div>
            ) : onTheClock ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  {onTheClock.teamName}
                  {onClockIsOpenSlot ? " (open)" : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Round {onTheClock.round} · Pick #{onTheClock.overall}
                </p>
                {onClockIsOpenSlot || onClockTeam?.autoPickEnabled ? (
                  <p className="text-xs text-muted-foreground">
                    Autopick on — drafting from queue / ADP
                  </p>
                ) : null}
                {secondsLeft != null ? (
                  <DraftClockSeconds seconds={secondsLeft} />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No more picks for you.
              </p>
            )}
          </DraftClockCard>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
          <TabsList>
            <TabsTrigger value="board">Draft Board</TabsTrigger>
            <TabsTrigger value="pool">Player Pool</TabsTrigger>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="roster">Roster</TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="pt-4">
            {tab === "board" ? (
              <DraftBoard
                slug={slug}
                schedule={schedule}
                picks={picks}
                teams={teams}
                rounds={rounds}
                currentPickIndex={currentPickIndex}
                status={effectiveStatus}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="pool" className="flex flex-col gap-4 pt-4">
            {tab === "pool" ? (
              <DraftPlayerPool
                slug={slug}
                data={poolPlayers}
                teams={nflTeams}
                draftedPlayerIds={draftedPlayerIds}
                draftLive={draftLive}
                draftComplete={draftComplete}
                isMyTurn={isMyTurn}
                isCommissioner={isCommissioner}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="queue" className="flex flex-col gap-4 pt-4">
            {tab === "queue" ? (
              <DraftQueuePanel slug={slug} items={queuedItems} />
            ) : null}
          </TabsContent>

          <TabsContent value="roster" className="pt-4">
            {tab === "roster" ? (
              <DraftRosterTab
                players={myDraftedPlayers}
                pickByPlayerId={pickByPlayerId}
                leagueSlug={slug}
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </DraftQueueProvider>
  );
}
