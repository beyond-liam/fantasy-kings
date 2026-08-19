"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  DraftClockCard,
  DraftClockSeconds,
} from "@/components/draft/draft-clock-card";
import {
  DraftAutopickStatusIcon,
  DraftTeamNameWithForcedAutopick,
} from "@/components/leagues/draft/draft-forced-autopick-indicator";
import {
  DraftClockToggle,
  DraftRevertControl,
} from "@/components/leagues/draft/draft-controls";
import { formatDraftStartsAt } from "@/lib/leagues/draft-status";
import type { DraftScheduleSlot } from "@/lib/leagues/draft/board";

type DraftRoomClockCardProps = {
  slug: string;
  isCommissioner: boolean;
  effectiveStatus: "scheduled" | "live" | "paused" | "complete" | null;
  waitingToStart: boolean;
  draftComplete: boolean;
  draftStartAt: string | null;
  startHint: string | null;
  clockEnabled: boolean;
  turnExpiresAt: string | null;
  pausedSecondsRemaining: number | null;
  pausedByWindow: boolean;
  livePickIndex: number;
  onTheClockLive: DraftScheduleSlot | null;
  onClockTeam: {
    forcedAutoPick?: boolean;
    autoPickEnabled?: boolean;
    userId?: string | null;
  } | null;
  onClockIsOpenSlot: boolean;
  isMyTurn: boolean;
  picksUntilUser: number | null;
  canRevert: boolean;
  onStatusOptimistic: (
    status: "scheduled" | "live" | "paused" | "complete" | null,
  ) => void;
  onClockExpired: () => void;
};

type DraftStatus = "scheduled" | "live" | "paused" | "complete" | null;

type LocalClock = {
  running: boolean;
  expiresAtMs: number | null;
  frozenSeconds: number | null;
};

type ClockHold =
  | { kind: "paused"; frozenSeconds: number }
  | { kind: "live"; expiresAtMs: number }
  | null;

function secondsFromExpiry(expiresAtMs: number, nowMs: number) {
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
}

function clockFromServer(input: {
  status: DraftStatus;
  turnExpiresAt: string | null;
  pausedSecondsRemaining: number | null;
  nowMs: number;
}): LocalClock {
  if (input.status === "paused") {
    if (input.pausedSecondsRemaining != null) {
      return {
        running: false,
        expiresAtMs: null,
        frozenSeconds: input.pausedSecondsRemaining,
      };
    }
    if (input.turnExpiresAt) {
      const expiresAtMs = new Date(input.turnExpiresAt).getTime();
      if (!Number.isNaN(expiresAtMs)) {
        return {
          running: false,
          expiresAtMs: null,
          frozenSeconds: secondsFromExpiry(expiresAtMs, input.nowMs),
        };
      }
    }
    return { running: false, expiresAtMs: null, frozenSeconds: null };
  }

  if (input.turnExpiresAt) {
    const expiresAtMs = new Date(input.turnExpiresAt).getTime();
    if (!Number.isNaN(expiresAtMs)) {
      return { running: true, expiresAtMs, frozenSeconds: null };
    }
  }

  return { running: false, expiresAtMs: null, frozenSeconds: null };
}

function resolveActiveClock(clockHold: ClockHold, serverClock: LocalClock): LocalClock {
  if (clockHold?.kind === "paused") {
    return {
      running: false,
      expiresAtMs: null,
      frozenSeconds: clockHold.frozenSeconds,
    };
  }
  if (clockHold?.kind === "live") {
    return {
      running: true,
      expiresAtMs: clockHold.expiresAtMs,
      frozenSeconds: null,
    };
  }
  return serverClock;
}

function resolveDisplayedSeconds(input: {
  clockEnabled: boolean;
  activeClock: LocalClock;
  nowMs: number;
  fallbackSeconds: number | null;
}): number | null {
  if (!input.clockEnabled) {
    return null;
  }
  if (!input.activeClock.running) {
    return input.activeClock.frozenSeconds ?? input.fallbackSeconds;
  }
  if (input.activeClock.expiresAtMs == null) {
    return input.fallbackSeconds;
  }
  return secondsFromExpiry(input.activeClock.expiresAtMs, input.nowMs);
}

export function DraftRoomClockCard({
  slug,
  isCommissioner,
  effectiveStatus,
  waitingToStart,
  draftComplete,
  draftStartAt,
  startHint,
  clockEnabled,
  turnExpiresAt,
  pausedSecondsRemaining,
  pausedByWindow,
  livePickIndex,
  onTheClockLive,
  onClockTeam,
  onClockIsOpenSlot,
  isMyTurn,
  picksUntilUser,
  canRevert,
  onStatusOptimistic,
  onClockExpired,
}: DraftRoomClockCardProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [clockHold, setClockHold] = useState<ClockHold>(null);
  const [fallbackSeconds, setFallbackSeconds] = useState<number | null>(null);
  const [boundPickIndex, setBoundPickIndex] = useState(livePickIndex);
  const expiredForTurnRef = useRef<number | null>(null);

  if (livePickIndex !== boundPickIndex) {
    setBoundPickIndex(livePickIndex);
    setClockHold(null);
  }

  const serverClock = useMemo(
    () =>
      clockFromServer({
        status: effectiveStatus,
        turnExpiresAt,
        pausedSecondsRemaining,
        nowMs,
      }),
    [effectiveStatus, turnExpiresAt, pausedSecondsRemaining, boundPickIndex, nowMs],
  );

  const activeClock = useMemo(
    () => resolveActiveClock(clockHold, serverClock),
    [clockHold, serverClock],
  );

  const displayedSeconds = useMemo(
    () =>
      resolveDisplayedSeconds({
        clockEnabled,
        activeClock,
        nowMs,
        fallbackSeconds,
      }),
    [clockEnabled, activeClock, nowMs, fallbackSeconds],
  );

  const showPickClock =
    clockEnabled &&
    (effectiveStatus === "live" || effectiveStatus === "paused") &&
    displayedSeconds != null;

  useEffect(() => {
    if (!activeClock.running) {
      return;
    }
    const tick = () => setNowMs(Date.now());
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [activeClock.running, activeClock.expiresAtMs]);

  useEffect(() => {
    if (!activeClock.running) {
      return;
    }
    if (displayedSeconds == null || displayedSeconds > 0 || !onTheClockLive) {
      if (onTheClockLive) {
        expiredForTurnRef.current = null;
      }
      return;
    }
    if (expiredForTurnRef.current === onTheClockLive.overall) {
      return;
    }
    expiredForTurnRef.current = onTheClockLive.overall;
    onClockExpired();
  }, [activeClock.running, displayedSeconds, onTheClockLive, onClockExpired]);

  const handleStatusOptimistic = (next: DraftStatus) => {
    const remaining = displayedSeconds ?? fallbackSeconds ?? 0;
    if (next === "paused") {
      setFallbackSeconds(remaining);
      setClockHold({ kind: "paused", frozenSeconds: remaining });
    } else if (next === "live") {
      const expiresAtMs = Date.now() + remaining * 1000;
      setFallbackSeconds(remaining);
      setNowMs(Date.now());
      setClockHold({ kind: "live", expiresAtMs });
    }
    onStatusOptimistic(next);
  };

  if (draftComplete) {
    return null;
  }

  const onClockLabel: ReactNode = onTheClockLive ? (
    <DraftTeamNameWithForcedAutopick
      name={`${onTheClockLive.teamName}${onClockIsOpenSlot ? " (open)" : ""}`}
      forcedAutoPick={onClockTeam?.forcedAutoPick}
      autoPickEnabled={onClockTeam?.autoPickEnabled}
      claimed={!onClockIsOpenSlot}
    />
  ) : null;

  const clockCardTitle = waitingToStart
    ? "Waiting to start"
    : effectiveStatus === "paused"
      ? pausedByWindow
        ? "Clock paused"
        : "Draft paused"
      : onTheClockLive
        ? "On the clock"
        : "Up next";

  const clockCardSubtitle = waitingToStart
    ? null
    : effectiveStatus === "paused"
      ? onClockLabel
      : isMyTurn
        ? (
            <span className="inline-flex items-center gap-1.5">
              <span>{`You · Pick #${onTheClockLive?.overall ?? ""}`}</span>
              <DraftAutopickStatusIcon
                forcedAutoPick={onClockTeam?.forcedAutoPick}
                autoPickEnabled={onClockTeam?.autoPickEnabled}
              />
            </span>
          )
        : onClockLabel;

  const waitingMessage = (() => {
    if (!draftStartAt) {
      return isCommissioner
        ? (startHint ?? "You can start the draft anytime.")
        : "Waiting for the commissioner to start.";
    }
    return formatDraftStartsAt(new Date(draftStartAt));
  })();

  const youreUpLabel =
    picksUntilUser === 0
      ? "You're up"
      : picksUntilUser != null && picksUntilUser > 0
        ? `You're up in ${picksUntilUser} ${picksUntilUser === 1 ? "pick" : "picks"}`
        : null;

  return (
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
            canRevert={canRevert}
            onStatusOptimistic={handleStatusOptimistic}
          />
          <DraftClockToggle
            slug={slug}
            isCommissioner={isCommissioner}
            status={effectiveStatus}
            startHint={startHint}
            onStatusOptimistic={handleStatusOptimistic}
          />
        </div>
      }
    >
      {waitingToStart ? (
        <p className="text-sm text-muted-foreground">{waitingMessage}</p>
      ) : onTheClockLive ? (
        <div className="flex flex-col gap-1">
          {showPickClock ? (
            <>
              <p className="text-xs text-muted-foreground">
                {effectiveStatus === "paused"
                  ? "Time remaining"
                  : "Pick expires in"}
              </p>
              <DraftClockSeconds seconds={displayedSeconds} />
            </>
          ) : !clockEnabled ? (
            <p className="text-xs text-muted-foreground">
              {picksUntilUser === 0
                ? "No time limit — pick when ready"
                : "No time limit"}
            </p>
          ) : null}
          {youreUpLabel ? (
            <p className="text-xs text-muted-foreground">{youreUpLabel}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No more picks for you.</p>
      )}
    </DraftClockCard>
  );
}
