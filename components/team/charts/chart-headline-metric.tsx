"use client";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ChartHeadlineMetricProps = {
  value: string;
  label: string;
  className?: string;
};

/** Large headline metric above a chart (value + muted label beside it). */
export function ChartHeadlineMetric({
  value,
  label,
  className,
}: ChartHeadlineMetricProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-3xl font-semibold tracking-tight text-balance">
          {value}
        </p>
        <p className="text-sm text-muted-foreground text-pretty">{label}</p>
      </div>
      <Separator />
    </div>
  );
}
