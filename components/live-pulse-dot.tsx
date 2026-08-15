import { cn } from "@/lib/utils";

/** Small solid core + hollow ring that expands and fades out. */
export function LivePulseDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-1.5 shrink-0 items-center justify-center",
        className,
      )}
      aria-hidden
    >
      <span className="animate-live-pulse absolute size-1.5 rounded-full border border-success bg-transparent" />
      <span className="relative size-1.5 rounded-full bg-success" />
    </span>
  );
}
