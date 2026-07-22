export type InjuryIndicatorTone = "questionable" | "out";

export type InjuryIndicator = {
  status: string;
  label: string;
  tone: InjuryIndicatorTone;
};

const QUESTIONABLE = new Set(["questionable", "q"]);

/** Statuses that typically mean the player will not play this week. */
const OUT = new Set([
  "out",
  "o",
  "doubtful",
  "d",
  "ir",
  "injured reserve",
  "pup",
  "physically unable to perform",
  "nfi",
  "non-football injury",
  "ex",
  "exempt",
  "suspended",
  "sus",
  "covid-19",
  "covid",
  "na",
  "inactive",
  "exhausted",
]);

const IGNORE = new Set(["active", "healthy", "probable", "p"]);

function normalizeInjuryStatus(status: string) {
  return status.trim().toLowerCase();
}

function matchesStatusToken(normalized: string, tokens: Set<string>) {
  if (tokens.has(normalized)) {
    return true;
  }
  // Handle compound labels like PUP-P, NFI-A, IR-R.
  const base = normalized.split(/[\s/_-]/)[0] ?? normalized;
  return tokens.has(base);
}

export function getInjuryIndicator(
  injuryStatus: string | null | undefined,
): InjuryIndicator | null {
  if (!injuryStatus?.trim()) {
    return null;
  }

  const normalized = normalizeInjuryStatus(injuryStatus);
  if (matchesStatusToken(normalized, IGNORE)) {
    return null;
  }

  const label = injuryStatus.trim();

  if (matchesStatusToken(normalized, QUESTIONABLE)) {
    return { status: injuryStatus, label, tone: "questionable" };
  }

  if (matchesStatusToken(normalized, OUT)) {
    return { status: injuryStatus, label, tone: "out" };
  }

  // Unknown designations: treat as out-of-game risk.
  return { status: injuryStatus, label, tone: "out" };
}
