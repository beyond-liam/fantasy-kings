/** True when this seat should autodraft (queue → BPA), not wait. */
export function isDraftAutopickDue(input: {
  isOpenSlot: boolean;
  enforceExpiry: boolean;
  hasTurnClock: boolean;
  clockExpired: boolean;
  /** Forced Autopick after consecutive missed clocks — timer does not apply. */
  clockExempt?: boolean;
}): boolean {
  if (!input.enforceExpiry) {
    return true;
  }
  if (input.clockExempt) {
    return true;
  }
  if (input.hasTurnClock) {
    return input.clockExpired;
  }
  return input.isOpenSlot;
}
