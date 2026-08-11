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
  type DraftPickEventPayload,
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
import type { PositionFilter } from "@/lib/rankings/column-config";

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
  /** League roster positions for the player pool filter. */
  positions?: readonly PositionFilter[];
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

function pickRowFromEvent(event: DraftPickEventPayload): DraftPickRow {
  return {
    id: event.id,
    overall: event.overall,
    round: event.round,
    pickInRound: event.pickInRound,
    teamId: event.teamId,
    playerId: event.playerId,
    source: event.source,
    madeAt: new Date(event.madeAt),
    playerFullName: event.playerFullName,
    playerPositionId: event.playerPositionId,
    playerNflTeam: event.playerNflTeam,
    playerByeWeek: event.playerByeWeek,
    playerSleeperId: event.playerSleeperId,
  };
}

function serverPickSignature(
  pickIndex: number,
  serverPicks: DraftPickRow[],
): string {
  return `${pickIndex}:${serverPicks.length}`;
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
  positions,
}: DraftRoomProps) {
  const router = useRouter();
  const [tab, setTab] = useState("board");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [optimisticStatus, setOptimisticStatus] = useState(status);
  const [prevStatus, setPrevStatus] = useState(status);
  const [liveTurnExpiresAt, setLiveTurnExpiresAt] = useState(turnExpiresAt);
  const [prevTurnExpiresAt, setPrevTurnExpiresAt] = useState(turnExpiresAt);
  const [livePausedSeconds, setLivePausedSeconds] = useState(
    pausedSecondsRemaining,
  );
  const [prevPausedSeconds, setPrevPausedSeconds] = useState(
    pausedSecondsRemaining,
  );
  const [livePicks, setLivePicks] = useState(picks);
  const [liveDraftedIds, setLiveDraftedIds] = useState(draftedPlayerIds);
  const [livePickIndex, setLivePickIndex] = useState(currentPickIndex);
  const [livePickByPlayerId, setLivePickByPlayerId] = useState(pickByPlayerId);
  const [liveMyDrafted, setLiveMyDrafted] = useState(myDraftedPlayers);
  const [propPickSig, setPropPickSig] = useState(() =>
    serverPickSignature(currentPickIndex, picks),
  );
  const autopickRef = useRef(false);
  const lastTurnCueRef = useRef<number | null>(null);
  const poolById = useMemo(
    () => new Map(poolPlayers.map((player) => [player.id, player])),
    [poolPlayers],
  );

  if (status !== prevStatus) {
    setPrevStatus(status);
    setOptimisticStatus(status);
  }

  if (turnExpiresAt !== prevTurnExpiresAt) {
    setPrevTurnExpiresAt(turnExpiresAt);
    setLiveTurnExpiresAt(turnExpiresAt);
  }

  if (pausedSecondsRemaining !== prevPausedSeconds) {
    setPrevPausedSeconds(pausedSecondsRemaining);
    setLivePausedSeconds(pausedSecondsRemaining);
  }

  const nextPropPickSig = serverPickSignature(currentPickIndex, picks);
  if (nextPropPickSig !== propPickSig) {
    setPropPickSig(nextPropPickSig);
    setLivePicks(picks);
    setLiveDraftedIds(draftedPlayerIds);
    setLivePickIndex(currentPickIndex);
    setLivePickByPlayerId(pickByPlayerId);
    setLiveMyDrafted(myDraftedPlayers);
  }

  const effectiveStatus = optimisticStatus;
  const draftLive = effectiveStatus === "live";
  const draftComplete = effectiveStatus === "complete";
  const onTheClockLive =
    effectiveStatus === "live" || effectiveStatus === "paused"
      ? (schedule[livePickIndex] ?? null)
      : onTheClock;
  const isMyTurn = Boolean(
    draftLive &&
      onTheClockLive &&
      myTeamId &&
      onTheClockLive.teamId === myTeamId,
  );

  const clockEnabled =
    pickTimeLimitSeconds > 0 &&
    (draftType === "live" || pickTimeLimitEnabled);

  const secondsLeft = computeSecondsLeft({
    status: effectiveStatus,
    clockEnabled,
    turnExpiresAt: liveTurnExpiresAt,
    pausedSecondsRemaining: livePausedSeconds,
    nowMs,
  });

  const onClockTeam = onTheClockLive
    ? (teams.find((team) => team.id === onTheClockLive.teamId) ?? null)
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
    for (let index = livePickIndex; index < schedule.length; index++) {
      if (schedule[index]?.teamId === myTeamId) {
        return index - livePickIndex;
      }
    }
    return null;
  }, [livePickIndex, myTeamId, schedule, effectiveStatus]);

  useEffect(() => {
    const onDraftPicks = (event: Event) => {
      const detail = (event as CustomEvent<DraftPicksPollResponse>).detail;
      if (!detail) {
        return;
      }

      if (detail.turnExpiresAt !== undefined) {
        setLiveTurnExpiresAt((prev) =>
          prev === detail.turnExpiresAt ? prev : (detail.turnExpiresAt ?? null),
        );
      }
      if (detail.pausedSecondsRemaining !== undefined) {
        setLivePausedSeconds((prev) =>
          prev === detail.pausedSecondsRemaining
            ? prev
            : (detail.pausedSecondsRemaining ?? null),
        );
      }
      if (detail.status) {
        setOptimisticStatus((prev) =>
          prev === detail.status ? prev : detail.status,
        );
      }

      if (typeof detail.afterOverall === "number") {
        setLivePickIndex((prev) => Math.max(prev, detail.afterOverall));
      }

      const incoming = detail.picks ?? [];
      if (incoming.length === 0) {
        return;
      }

      setLivePicks((prev) => {
        const byOverall = new Map(prev.map((pick) => [pick.overall, pick]));
        for (const eventPick of incoming) {
          if (!byOverall.has(eventPick.overall)) {
            byOverall.set(eventPick.overall, pickRowFromEvent(eventPick));
          }
        }
        return [...byOverall.values()].toSorted(
          (a, b) => a.overall - b.overall,
        );
      });

      setLiveDraftedIds((prev) => {
        const next = new Set(prev);
        for (const eventPick of incoming) {
          next.add(eventPick.playerId);
        }
        return [...next];
      });

      setLivePickByPlayerId((prev) => {
        const next = { ...prev };
        for (const eventPick of incoming) {
          next[eventPick.playerId] = eventPick.overall;
        }
        return next;
      });

      if (myTeamId) {
        const mine = incoming.filter(
          (eventPick) => eventPick.teamId === myTeamId,
        );
        if (mine.length > 0) {
          setLiveMyDrafted((prev) => {
            const seen = new Set(prev.map((player) => player.id));
            const next = [...prev];
            for (const eventPick of mine) {
              if (seen.has(eventPick.playerId)) continue;
              const fromPool = poolById.get(eventPick.playerId);
              if (fromPool) {
                next.push(fromPool);
                seen.add(eventPick.playerId);
              }
            }
            return next;
          });
        }
      }
    };

    window.addEventListener(DRAFT_PICKS_EVENT, onDraftPicks);
    return () => {
      window.removeEventListener(DRAFT_PICKS_EVENT, onDraftPicks);
    };
  }, [myTeamId, poolById]);

  // Tick the pick clock while live.
  useEffect(() => {
    if (!clockEnabled || effectiveStatus !== "live") {
      return;
    }
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [clockEnabled, effectiveStatus, liveTurnExpiresAt, livePickIndex]);

  // Cue sound when it becomes your turn.
  useEffect(() => {
    if (!draftLive || !isMyTurn || !onTheClockLive) {
      return;
    }
    if (lastTurnCueRef.current === onTheClockLive.overall) {
      return;
    }
    lastTurnCueRef.current = onTheClockLive.overall;
    playDraftSound("/sound-youre-up.mp3");
  }, [draftLive, isMyTurn, onTheClockLive]);

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
    livePickIndex,
    onTheClockLive?.overall,
  ]);

  // Autopick when the clock hits zero; retry while it stays expired.
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

    let cancelled = false;
    let retryId = 0;
    let inFlight = false;

    const attempt = async () => {
      if (cancelled || inFlight) {
        return;
      }
      inFlight = true;
      const result = await autoDraftCurrentPick(slug);
      inFlight = false;
      if (cancelled) {
        return;
      }
      if (result.success) {
        return;
      }
      retryId = window.setTimeout(() => {
        void attempt();
      }, 5_000);
    };

    void attempt();

    return () => {
      cancelled = true;
      window.clearTimeout(retryId);
    };
  }, [
    autopickAllowed,
    clockEnabled,
    draftLive,
    secondsLeft,
    slug,
    livePickIndex,
    liveTurnExpiresAt,
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

  const onClockLabel = onTheClockLive
    ? `${onTheClockLive.teamName}${onClockIsOpenSlot ? " (open)" : ""}`
    : null;

  const clockCardTitle = waitingToStart
    ? "Waiting to start"
    : effectiveStatus === "paused"
      ? "Draft paused"
      : onTheClockLive
        ? "On the clock"
        : "Up next";

  const clockCardSubtitle = waitingToStart
    ? null
    : effectiveStatus === "paused"
      ? onClockLabel
      : isMyTurn
        ? `You · Pick #${onTheClockLive?.overall ?? ""}`
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
          </div>

          {!draftComplete ? (
            <DraftClockCard
              title={clockCardTitle}
              subtitle={clockCardSubtitle}
              className="max-md:w-full max-md:min-w-0"
              showStopwatch
              headerAction={
                <div className="flex items-center gap-1.5">
                  <DraftRevertControl
                    slug={slug}
                    isCommissioner={isCommissioner}
                    status={effectiveStatus}
                    canRevert={livePickIndex > 0}
                    onStatusOptimistic={setOptimisticStatus}
                  />
                  <DraftClockToggle
                    slug={slug}
                    isCommissioner={isCommissioner}
                    status={effectiveStatus}
                    startHint={startHint}
                    onStatusOptimistic={setOptimisticStatus}
                  />
                </div>
              }
            >
              {waitingToStart ? (
                <p className="text-sm text-muted-foreground">{waitingMessage}</p>
              ) : isMyTurn && onTheClockLive ? (
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
                        ? `Round ${onTheClockLive.round} · Pick ${onTheClockLive.overall}`
                        : "No time limit — pick when ready"}
                    </p>
                  )}
                </div>
              ) : onTheClockLive &&
                picksUntilUser != null &&
                picksUntilUser > 0 ? (
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
              ) : onTheClockLive ? (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    Round {onTheClockLive.round} · Pick #{onTheClockLive.overall}
                  </p>
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
                picks={livePicks}
                teams={teams}
                rounds={rounds}
                currentPickIndex={livePickIndex}
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
                draftedPlayerIds={liveDraftedIds}
                draftLive={draftLive}
                draftComplete={draftComplete}
                isMyTurn={isMyTurn}
                isCommissioner={isCommissioner}
                positions={positions}
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
                players={liveMyDrafted}
                pickByPlayerId={livePickByPlayerId}
                leagueSlug={slug}
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </DraftQueueProvider>
  );
}
