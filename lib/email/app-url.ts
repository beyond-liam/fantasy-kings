function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function isLocalhostUrl(value: string) {
  try {
    const host = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    ).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function normalizeBaseUrl(raw: string) {
  const trimmed = stripTrailingSlash(raw.trim());
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

type AppUrlEnv = {
  nodeEnv?: string;
  appUrl?: string;
  nextPublicAppUrl?: string;
  vercelProjectProductionUrl?: string;
  vercelUrl?: string;
};

function readAppUrlEnv(overrides?: AppUrlEnv): AppUrlEnv {
  return {
    nodeEnv: overrides?.nodeEnv ?? process.env.NODE_ENV,
    appUrl: overrides?.appUrl ?? process.env.APP_URL,
    nextPublicAppUrl:
      overrides?.nextPublicAppUrl ?? process.env.NEXT_PUBLIC_APP_URL,
    vercelProjectProductionUrl:
      overrides?.vercelProjectProductionUrl ??
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    vercelUrl: overrides?.vercelUrl ?? process.env.VERCEL_URL,
  };
}

/**
 * Public site origin for absolute links (emails, etc.).
 * Prefers explicit app URL, then Vercel production / deployment hosts.
 * In production, localhost candidates are skipped so a mis-set
 * NEXT_PUBLIC_APP_URL cannot poison outbound email links.
 */
export function getAppBaseUrl(overrides?: AppUrlEnv) {
  const env = readAppUrlEnv(overrides);
  const candidates = [
    env.appUrl,
    env.nextPublicAppUrl,
    env.vercelProjectProductionUrl,
    env.vercelUrl,
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) {
      continue;
    }
    const normalized = normalizeBaseUrl(candidate);
    if (!normalized) {
      continue;
    }
    if (env.nodeEnv === "production" && isLocalhostUrl(normalized)) {
      continue;
    }
    return normalized;
  }

  if (env.nodeEnv === "production") {
    console.error(
      "[email] No public app URL configured (APP_URL / NEXT_PUBLIC_APP_URL / VERCEL_*). Email links may be wrong.",
    );
  }

  return "http://localhost:3000";
}

/** Turn a path or URL into an absolute app URL for email CTAs. */
export function absoluteAppUrl(pathOrUrl: string, overrides?: AppUrlEnv) {
  const trimmed = pathOrUrl.trim();
  const base = getAppBaseUrl(overrides);
  if (!trimmed) {
    return base;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const env = readAppUrlEnv(overrides);
    if (env.nodeEnv === "production" && isLocalhostUrl(trimmed)) {
      try {
        const parsed = new URL(trimmed);
        return `${base}${parsed.pathname}${parsed.search}${parsed.hash}`;
      } catch {
        return base;
      }
    }
    return trimmed;
  }

  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

export function draftRoomUrl(leaguePublicId: string, overrides?: AppUrlEnv) {
  return absoluteAppUrl(`/league/${leaguePublicId}/draft`, overrides);
}

export function tradesUrl(leaguePublicId: string, overrides?: AppUrlEnv) {
  return absoluteAppUrl(`/league/${leaguePublicId}/trades`, overrides);
}

export function rosterUrl(leaguePublicId: string, overrides?: AppUrlEnv) {
  return absoluteAppUrl(`/league/${leaguePublicId}/team`, overrides);
}

export function transactionsUrl(leaguePublicId: string, overrides?: AppUrlEnv) {
  return absoluteAppUrl(
    `/league/${leaguePublicId}/team?tab=transactions`,
    overrides,
  );
}

export function matchupUrl(
  leaguePublicId: string,
  matchupPublicId: string,
  overrides?: AppUrlEnv,
) {
  return absoluteAppUrl(
    `/league/${leaguePublicId}/scores/${matchupPublicId}`,
    overrides,
  );
}

export function messagesUrl(
  leaguePublicId: string,
  threadPublicId: string,
  overrides?: AppUrlEnv,
) {
  return absoluteAppUrl(
    `/league/${leaguePublicId}/messages/${threadPublicId}`,
    overrides,
  );
}
