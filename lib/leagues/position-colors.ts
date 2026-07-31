/** Shared position colour coding — draft board, roster badges, anywhere else. */
const POSITION_TONE: Record<string, string> = {
  QB: "bg-rose-500/20 text-rose-100 ring-rose-500/40",
  RB: "bg-sky-500/20 text-sky-100 ring-sky-500/40",
  WR: "bg-emerald-500/20 text-emerald-100 ring-emerald-500/40",
  TE: "bg-violet-500/20 text-violet-100 ring-violet-500/40",
  K: "bg-amber-500/20 text-amber-100 ring-amber-500/40",
  DEF: "bg-slate-500/25 text-slate-100 ring-slate-400/40",
  FLEX: "bg-teal-500/20 text-teal-100 ring-teal-500/40",
  BN: "bg-slate-500/25 text-slate-100 ring-slate-400/40",
  IR: "bg-orange-500/20 text-orange-100 ring-orange-500/40",
  TAXI: "bg-cyan-500/20 text-cyan-100 ring-cyan-500/40",
};

const FALLBACK_TONE = "bg-muted/40 text-foreground ring-border/60";

export function positionToneClass(positionId: string) {
  return POSITION_TONE[positionId] ?? FALLBACK_TONE;
}

/** Compact badge text for a roster slot (TAXI shows as TX). */
export function slotBadgeLabel(slotPositionId: string) {
  return slotPositionId === "TAXI" ? "TX" : slotPositionId;
}
