"use client";

import { cn } from "@/lib/utils";
import type { WizardStep } from "@/lib/leagues/wizard-schema";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "setup", label: "League setup" },
  { id: "roster", label: "Rosters & scoring" },
  { id: "transactions", label: "Transactions" },
  { id: "draft", label: "Draft" },
  { id: "review", label: "Review" },
];

type WizardProgressProps = {
  currentStep: WizardStep;
};

export function WizardProgress({ currentStep }: WizardProgressProps) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep);

  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      {STEPS.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = step.id === currentStep;

        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                isComplete && "bg-primary text-primary-foreground",
                isCurrent && "bg-primary/20 text-primary ring-2 ring-primary",
                !isComplete && !isCurrent && "bg-muted text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                "text-sm",
                isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
