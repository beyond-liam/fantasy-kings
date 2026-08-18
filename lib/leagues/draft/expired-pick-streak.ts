export type ExpiredPickStreakInput = {
  source: "manual" | "commissioner" | "autopick";
  missedClock: boolean;
  consecutiveExpiredPicks: number;
  forcedAutoPick: boolean;
  forceAutopickAfterTwoExpires: boolean;
};

export type ExpiredPickStreakResult = {
  consecutiveExpiredPicks: number;
  forcedAutoPick: boolean;
  /** Set only when Autopick should be turned on or off as part of this pick. */
  autoPickEnabled?: boolean;
};

/**
 * Consecutive clock-expiry autodrafts. Two in a row (when the league setting
 * is on) force autopick and skip the pick timer until the manager returns.
 */
export function nextExpiredPickStreak(
  input: ExpiredPickStreakInput,
): ExpiredPickStreakResult {
  if (input.source === "autopick" && input.missedClock && !input.forcedAutoPick) {
    const consecutiveExpiredPicks = input.consecutiveExpiredPicks + 1;
    const shouldForce =
      input.forceAutopickAfterTwoExpires && consecutiveExpiredPicks >= 2;
    return {
      consecutiveExpiredPicks,
      forcedAutoPick: shouldForce,
      ...(shouldForce ? { autoPickEnabled: true } : {}),
    };
  }

  if (input.source === "manual") {
    return {
      consecutiveExpiredPicks: 0,
      forcedAutoPick: false,
      ...(input.forcedAutoPick ? { autoPickEnabled: false } : {}),
    };
  }

  return {
    consecutiveExpiredPicks: 0,
    forcedAutoPick: input.forcedAutoPick,
  };
}

/**
 * Replay a team's pick sources. Historical autopicks count as clock misses
 * (the pick row does not store whether the clock expired).
 */
export function expiredPickStreakFromSources(
  sources: Array<"manual" | "commissioner" | "autopick">,
  forceAutopickAfterTwoExpires: boolean,
): ExpiredPickStreakResult {
  let state: ExpiredPickStreakResult = {
    consecutiveExpiredPicks: 0,
    forcedAutoPick: false,
  };

  for (const source of sources) {
    state = nextExpiredPickStreak({
      source,
      missedClock: source === "autopick",
      consecutiveExpiredPicks: state.consecutiveExpiredPicks,
      forcedAutoPick: state.forcedAutoPick,
      forceAutopickAfterTwoExpires,
    });
  }

  return state;
}
