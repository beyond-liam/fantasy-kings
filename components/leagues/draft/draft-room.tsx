"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DashboardSquare01Icon,
  ListChecks as ListChecksIcon,
  StudentCardIcon,
  UserMultiple03Icon,
} from "@hugeicons/core-free-icons";

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
import {
  MobileTabDrawer,
  type MobileTabDrawerItem,
} from "@/components/layout/mobile-tab-drawer";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { autoDraftCurrentPick, tryAutoStartDraft } from "@/lib/actions/draft";
import { formatDraftStartsAt } from "@/lib/leagues/draft-status";
import type { DraftScheduleSlot } from "@/lib/leagues/draft/board";
import type { DraftPickRow, DraftQueueRow } from "@/lib/queries/draft";
import type { RankedPlayerRow } from "@/lib/queries/players";

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

const DRAFT_TABS: readonly MobileTabDrawerItem[] = [
  { value: "board", label: "Draft Board", icon: DashboardSquare01Icon },
  { value: "pool", label: "Player Pool", icon: UserMultiple03Icon },
  { value: "queue", label: "Queue", icon: ListChecksIcon },
  { value: "roster", label: "Roster", icon: StudentCardIcon },
];

function playDraftSound(src: string) {
  try {
    const audio = new Audio(src);
    void audio.play();
  } catch {
    // Ignore autoplay / missing file failures.
  }
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

  const onClockLabel = onTheClock
    ? `${onTheClock.teamName}${onClockIsOpenSlot ? " (open)" : ""}`
    : null;

  const clockCardTitle = waitingToStart
    ? "Waiting to start"
    : effectiveStatus === "paused"
      ? "Draft paused"
      : onTheClock
        ? "On the clock"
        : "Up next";

  const clockCardSubtitle = waitingToStart
    ? null
    : effectiveStatus === "paused"
      ? onClockLabel
      : isMyTurn
        ? `You · Pick #${onTheClock?.overall ?? ""}`
        : onClockLabel;

  const waitingMessage = (() => {
    if (!draftStartAt) {
      return isCommissioner
        ? (startHint ?? "You can start the draft anytime.")
        : "Waiting for the commissioner to start.";
    }
    return formatDraftStartsAt(new Date(draftStartAt));
  })();

  return (
    <DraftQueueProvider slug={slug} initialQueuedIds={queuedPlayerIds}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
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
          </div>

          {!draftComplete ? (
            <DraftClockCard
              title={clockCardTitle}
              subtitle={clockCardSubtitle}
              className="max-md:w-full max-md:min-w-0"
              showStopwatch
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
              {waitingToStart ? (
                <p className="text-sm text-muted-foreground">{waitingMessage}</p>
              ) : isMyTurn && onTheClock ? (
                <div className="flex flex-col gap-1">
                  {secondsLeft != null ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Pick expires in
                      </p>
                      <DraftClockSeconds seconds={secondsLeft} />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {clockEnabled
                        ? `Round ${onTheClock.round} · Pick ${onTheClock.overall}`
                        : "No time limit — pick when ready"}
                    </p>
                  )}
                </div>
              ) : onTheClock && picksUntilUser != null && picksUntilUser > 0 ? (
                secondsLeft != null ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">
                      Pick expires in
                    </p>
                    <DraftClockSeconds seconds={secondsLeft} />
                    <p className="text-sm text-muted-foreground">
                      You&apos;re up in {picksUntilUser}{" "}
                      {picksUntilUser === 1 ? "pick" : "picks"}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm">
                    You&apos;re up in {picksUntilUser}{" "}
                    {picksUntilUser === 1 ? "pick" : "picks"}
                  </p>
                )
              ) : onTheClock ? (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    Round {onTheClock.round} · Pick #{onTheClock.overall}
                  </p>
                  {onClockIsOpenSlot || onClockTeam?.autoPickEnabled ? (
                    <p className="text-xs text-muted-foreground">
                      Autopick on — drafting from queue / ADP
                    </p>
                  ) : null}
                  {secondsLeft != null ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Pick expires in
                      </p>
                      <DraftClockSeconds seconds={secondsLeft} />
                    </>
                  ) : !clockEnabled ? (
                    <p className="text-sm text-muted-foreground">
                      No time limit
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No more picks for you.
                </p>
              )}
            </DraftClockCard>
          ) : null}
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
          <TabsList className="hidden md:inline-flex">
            {DRAFT_TABS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <MobileTabDrawer
            items={DRAFT_TABS}
            value={tab}
            onSelect={setTab}
            title="Draft sections"
            description="Choose which draft section to view"
          />

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
