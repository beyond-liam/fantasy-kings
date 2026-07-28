#!/usr/bin/env node
/**
 * Synthetic Lighthouse for Fantasy Kings league routes.
 *
 * Unauthenticated smoke (login / rankings):
 *   pnpm lighthouse:smoke
 *
 * Authenticated league routes (requires a session cookie):
 *   1. Start the app (`pnpm dev` or `pnpm start`)
 *   2. Log in in Chrome → DevTools → Application → Cookies
 *   3. Copy cookie string for the app origin (sb-*-auth-token, etc.)
 *   4. Run:
 *        LIGHTHOUSE_BASE_URL=http://localhost:3000 \
 *        LIGHTHOUSE_COOKIE='sb-xxx-auth-token=...' \
 *        LIGHTHOUSE_LEAGUE_ID=abc123 \
 *        pnpm lighthouse:league
 *
 * Reports write to .lighthouse/ (gitignored).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const baseUrl = (
  process.env.LIGHTHOUSE_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const cookie = process.env.LIGHTHOUSE_COOKIE?.trim() ?? "";
const leagueId = process.env.LIGHTHOUSE_LEAGUE_ID?.trim() ?? "";
const mode = process.argv[2] === "league" ? "league" : "smoke";

const outDir = join(process.cwd(), ".lighthouse");
mkdirSync(outDir, { recursive: true });

const urls =
  mode === "league"
    ? [
        `${baseUrl}/league/${leagueId}`,
        `${baseUrl}/league/${leagueId}?tab=standings`,
        `${baseUrl}/league/${leagueId}/players`,
        `${baseUrl}/league/${leagueId}/team`,
        `${baseUrl}/league/${leagueId}/scores`,
      ]
    : [`${baseUrl}/login`, `${baseUrl}/rankings`];

if (mode === "league" && !leagueId) {
  console.error("Set LIGHTHOUSE_LEAGUE_ID to a league public id.");
  process.exit(1);
}

if (mode === "league" && !cookie) {
  console.error(
    "Set LIGHTHOUSE_COOKIE to an authenticated session cookie string.",
  );
  process.exit(1);
}

const summary = [];

for (const url of urls) {
  const slug =
    url
      .replace(baseUrl, "")
      .replace(/^\//, "")
      .replace(/[/?=&]/g, "_") || "root";
  const reportPath = join(outDir, `${mode}-${slug}`);

  const args = [
    "dlx",
    "lighthouse",
    url,
    "--only-categories=performance,accessibility",
    "--output=json",
    "--output=html",
    `--output-path=${reportPath}`,
    "--chrome-flags=--headless --no-sandbox",
    "--quiet",
  ];

  if (cookie) {
    args.push("--extra-headers", JSON.stringify({ Cookie: cookie }));
  }

  console.log(`\n→ ${url}`);
  const result = spawnSync("pnpm", args, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || "lighthouse failed");
    process.exit(result.status ?? 1);
  }

  try {
    const json = JSON.parse(readFileSync(`${reportPath}.report.json`, "utf8"));
    const perf = json.categories?.performance?.score;
    const lcp = json.audits?.["largest-contentful-paint"]?.numericValue;
    const ttfb = json.audits?.["server-response-time"]?.numericValue;
    const inp = json.audits?.["interaction-to-next-paint"]?.numericValue;
    const cls = json.audits?.["cumulative-layout-shift"]?.numericValue;
    const row = {
      url,
      performance: perf == null ? null : Math.round(perf * 100),
      lcpMs: lcp == null ? null : Math.round(lcp),
      ttfbMs: ttfb == null ? null : Math.round(ttfb),
      inpMs: inp == null ? null : Math.round(inp),
      cls: cls == null ? null : Number(cls.toFixed(3)),
      html: `${reportPath}.report.html`,
    };
    summary.push(row);
    console.log(
      `  perf=${row.performance} LCP=${row.lcpMs}ms TTFB=${row.ttfbMs}ms`,
    );
  } catch (error) {
    console.warn(`  (could not parse JSON report: ${error})`);
  }
}

writeFileSync(
  join(outDir, `${mode}-summary.json`),
  JSON.stringify(summary, null, 2),
);
console.log(`\nWrote ${outDir}/${mode}-summary.json`);
