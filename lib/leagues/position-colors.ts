/**
 * Shared position colour coding — draft board, roster badges, anywhere else.
 *
 * QB rose · RB sky · WR emerald · TE violet · K amber · FLEX teal · DEF gray
 * IDP (CB/S/DT/DE/LB) pink
 *
 * Light mode uses darker text on soft fills; dark mode uses light text.
 */
const IDP_TONE =
  "bg-pink-500/15 text-pink-800 ring-pink-500/35 dark:bg-pink-500/20 dark:text-pink-100 dark:ring-pink-500/40";

const POSITION_TONE: Record<string, string> = {
  QB: "bg-rose-500/15 text-rose-800 ring-rose-500/35 dark:bg-rose-500/20 dark:text-rose-100 dark:ring-rose-500/40",
  RB: "bg-sky-500/15 text-sky-800 ring-sky-500/35 dark:bg-sky-500/20 dark:text-sky-100 dark:ring-sky-500/40",
  WR: "bg-emerald-500/15 text-emerald-800 ring-emerald-500/35 dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-500/40",
  TE: "bg-violet-500/15 text-violet-800 ring-violet-500/35 dark:bg-violet-500/20 dark:text-violet-100 dark:ring-violet-500/40",
  K: "bg-amber-500/15 text-amber-900 ring-amber-500/35 dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-500/40",
  FLEX: "bg-teal-500/15 text-teal-800 ring-teal-500/35 dark:bg-teal-500/20 dark:text-teal-100 dark:ring-teal-500/40",
  DEF: "bg-gray-500/15 text-gray-800 ring-gray-500/35 dark:bg-gray-500/25 dark:text-gray-100 dark:ring-gray-400/40",
  CB: IDP_TONE,
  S: IDP_TONE,
  DE: IDP_TONE,
  DT: IDP_TONE,
  LB: IDP_TONE,
  BN: "bg-gray-500/15 text-gray-800 ring-gray-500/35 dark:bg-gray-500/25 dark:text-gray-100 dark:ring-gray-400/40",
  IR: "bg-orange-500/15 text-orange-900 ring-orange-500/35 dark:bg-orange-500/20 dark:text-orange-100 dark:ring-orange-500/40",
  TAXI: "bg-cyan-500/15 text-cyan-900 ring-cyan-500/35 dark:bg-cyan-500/20 dark:text-cyan-100 dark:ring-cyan-500/40",
};

const FALLBACK_TONE = "bg-muted/40 text-foreground ring-border/60";

/** Shared shell for roster / matchup slot badges. */
export const POSITION_BADGE_CLASSNAME =
  "inline-flex h-6 min-w-9 shrink-0 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold ring-1 ring-inset tabular-nums";

export function positionToneClass(positionId: string) {
  return POSITION_TONE[positionId] ?? FALLBACK_TONE;
}

/** Compact badge text for a roster slot (TAXI shows as TX). */
export function slotBadgeLabel(slotPositionId: string) {
  return slotPositionId === "TAXI" ? "TX" : slotPositionId;
}
