"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
  const expiredForTurnRef = useRef<number | null>(null);
  const lastSecondsRef = useRef<number | null>(null);
  const clockHoldRef = useRef<"live" | "paused" | null>(null);
  const [localClock, setLocalClock] = useState<LocalClock>(() =>
    clockFromServer({
      status: effectiveStatus,
      turnExpiresAt,
      pausedSecondsRemaining,
      nowMs: Date.now(),
    }),
  );

  const displayedSeconds = (() => {
    if (!clockEnabled) {
      return null;
    }
    if (!localClock.running) {
      return localClock.frozenSeconds ?? lastSecondsRef.current;
    }
    if (localClock.expiresAtMs == null) {
      return lastSecondsRef.current;
    }
    return secondsFromExpiry(localClock.expiresAtMs, nowMs);
  })();

  if (displayedSeconds != null) {
    lastSecondsRef.current = displayedSeconds;
  }

  const showPickClock =
    clockEnabled &&
    (effectiveStatus === "live" || effectiveStatus === "paused") &&
    displayedSeconds != null;

  useEffect(() => {
    if (!localClock.running) {
      return;
    }
    const tick = () => setNowMs(Date.now());
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [localClock.running, localClock.expiresAtMs]);

  useEffect(() => {
    if (clockHoldRef.current) {
      return;
    }
    setLocalClock(
      clockFromServer({
        status: effectiveStatus,
        turnExpiresAt,
        pausedSecondsRemaining,
        nowMs: Date.now(),
      }),
    );
  }, [
    effectiveStatus,
    turnExpiresAt,
    pausedSecondsRemaining,
  ]);

  useEffect(() => {
    clockHoldRef.current = null;
    setLocalClock(
      clockFromServer({
        status: effectiveStatus,
        turnExpiresAt,
        pausedSecondsRemaining,
        nowMs: Date.now(),
      }),
    );
    // New pick: take the server clock. Pause/resume must not reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pick index only
  }, [livePickIndex]);

  const handleStatusOptimistic = (next: DraftStatus) => {
    const remaining = displayedSeconds ?? lastSecondsRef.current ?? 0;
    if (next === "paused") {
      clockHoldRef.current = "paused";
      setLocalClock({
        running: false,
        expiresAtMs: null,
        frozenSeconds: remaining,
      });
    } else if (next === "live") {
      clockHoldRef.current = "live";
      const expiresAtMs = Date.now() + remaining * 1000;
      setNowMs(Date.now());
      setLocalClock({
        running: true,
        expiresAtMs,
        frozenSeconds: null,
      });
    }
    onStatusOptimistic(next);
  };

  useEffect(() => {
    if (!localClock.running) {
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
  }, [localClock.running, displayedSeconds, onTheClockLive, onClockExpired]);

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
